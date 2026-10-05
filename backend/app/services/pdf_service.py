"""PDF 导出服务：把打印用 HTML 交给本机 Chromium 内核浏览器排版并打印。

jsPDF 内置字体没有中文字形，旧方案只能把排版结果用 html2canvas 光栅化成 JPEG
（135~230KB/页，300 页约 40~70MB，且没有文字层）。改成浏览器打印后：

* 中文由浏览器自己嵌入字体子集，实测 274 页 / 18 万汉字 = 2.78MB（约 10KB/页）；
* PDF 带文字层，可以搜索、复制；
* 排版（断行、避头尾、分页）交给 Chromium，前端不再需要保留整本书的图像数据。

实现走 CDP（Chrome DevTools Protocol）：headless 启动 Edge/Chrome，用
``Page.printToPDF`` 直接拿到矢量的 PDF。依赖只有 websockets
（uvicorn[standard] 已经间接带了），不引入 Playwright 这类重依赖。
"""

from __future__ import annotations

import asyncio
import base64
import html as html_module
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import websockets

from app.core.config import settings

# 启动浏览器、打开页面、等待字体就绪的超时（秒）
LAUNCH_TIMEOUT = 30.0
# 单次打印的超时：300 页的小说实测 2~6 秒，留足余量
PRINT_TIMEOUT = 180.0

# 页面边距（英寸，CDP 的 margin* 参数只接受英寸）。用 API 参数控制而不是 CSS
# 的 @page margin，是为了让页眉/页脚有确定的绘制区域。
MARGIN_TOP_IN = 22 / 25.4
MARGIN_BOTTOM_IN = 20 / 25.4
MARGIN_LEFT_IN = 18 / 25.4
MARGIN_RIGHT_IN = 18 / 25.4

# 打印模板必须显式写明 font-size，否则 Chromium 不会渲染。
# font-family 也必须点名一个"静态 CJK 字体"：模板默认的 sans-serif 缺少中文字形，
# 结果是页眉书名与"第 N 页"直接不显示，而且整份 PDF 退化成 Type3 位图字形
# （实测同一页：SimSun 10KB / sans-serif 31KB）。
# 注意字体名里的双引号：模板用 style='...' 单引号属性，否则双引号会提前结束属性，
# CSS 整条失效——表现同样是中文页眉页脚消失、体积翻三倍。
_TEMPLATE_FONT_STACK = (
    'SimSun, "Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", serif'
)
_TEMPLATE_STYLE = (
    f"font-family: {_TEMPLATE_FONT_STACK}; font-size: 9px; color: #666666; "
    "width: 100%; padding: 0 18mm; box-sizing: border-box;"
)

_LAUNCH_FLAGS = (
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--window-size=1200,1600",
)


class PdfBrowserUnavailable(RuntimeError):
    """本机找不到可用的 Chromium 内核浏览器。"""


class PdfRenderError(RuntimeError):
    """找到了浏览器，但打印过程失败。"""


def find_browser() -> Path:
    """按配置 → 常见安装路径 → PATH 的顺序找一个 Chromium 内核浏览器。"""
    override = (
        settings.PDF_BROWSER_PATH or os.environ.get("LOCALSCRIBE_PDF_BROWSER") or ""
    ).strip()
    candidates: List[Path] = [Path(override)] if override else []

    if sys.platform == "win32":
        for variable in ("PROGRAMFILES(X86)", "PROGRAMFILES", "LOCALAPPDATA"):
            base = os.environ.get(variable)
            if not base:
                continue
            candidates.append(Path(base) / "Microsoft/Edge/Application/msedge.exe")
            candidates.append(Path(base) / "Google/Chrome/Application/chrome.exe")
    elif sys.platform == "darwin":
        candidates.extend(
            [
                Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
                Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
                Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
            ]
        )
    else:
        for name in ("microsoft-edge", "google-chrome", "chromium", "chromium-browser"):
            found = shutil.which(name)
            if found:
                candidates.append(Path(found))

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    raise PdfBrowserUnavailable(
        "未找到 Microsoft Edge 或 Google Chrome，无法导出 PDF；可设置 PDF_BROWSER_PATH 指定浏览器路径"
    )


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _header_template(title: str) -> str:
    return f"<div style='{_TEMPLATE_STYLE}'>{html_module.escape(title)}</div>"


def _footer_template() -> str:
    return (
        f"<div style='{_TEMPLATE_STYLE} text-align: center;'>"
        '第 <span class="pageNumber"></span> 页</div>'
    )


def _print_params(title: str) -> Dict[str, Any]:
    return {
        "printBackground": True,
        # A4 由打印 HTML 里的 @page size 决定，页边距由这里的参数决定
        "preferCSSPageSize": True,
        "displayHeaderFooter": True,
        "headerTemplate": _header_template(title),
        "footerTemplate": _footer_template(),
        "marginTop": MARGIN_TOP_IN,
        "marginBottom": MARGIN_BOTTOM_IN,
        "marginLeft": MARGIN_LEFT_IN,
        "marginRight": MARGIN_RIGHT_IN,
        "transferMode": "ReturnAsBase64",
    }


class _CdpSession:
    """只用到 CDP 的一问一答：发命令、等回包、等事件。"""

    def __init__(self, connection: Any) -> None:
        self._connection = connection
        self._next_id = 0

    async def send(
        self, method: str, params: Optional[Dict[str, Any]] = None, *, timeout: float
    ) -> Dict[str, Any]:
        self._next_id += 1
        message_id = self._next_id
        await self._connection.send(
            json.dumps({"id": message_id, "method": method, "params": params or {}})
        )

        while True:
            try:
                raw = await asyncio.wait_for(self._connection.recv(), timeout=timeout)
            except asyncio.TimeoutError as error:
                raise PdfRenderError(f"{method} 超时") from error
            message = json.loads(raw)
            if message.get("id") != message_id:
                # 打印期间浏览器还会推送事件，直接跳过
                continue
            if "error" in message:
                raise PdfRenderError(f"{method} 调用失败：{message['error']}")
            return message.get("result") or {}

    async def wait_event(self, method: str, *, timeout: float) -> None:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise PdfRenderError(f"等待事件超时：{method}")
            try:
                raw = await asyncio.wait_for(self._connection.recv(), timeout=remaining)
            except asyncio.TimeoutError as error:
                raise PdfRenderError(f"等待事件超时：{method}") from error
            message = json.loads(raw)
            if message.get("method") == method:
                return


async def _wait_for_page_target(port: int, timeout: float) -> str:
    """等浏览器的调试端口起来，并拿到初始空白页的 WebSocket 地址。"""
    endpoint = f"http://127.0.0.1:{port}/json/list"
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout

    async with httpx.AsyncClient(timeout=2.0) as client:
        while True:
            try:
                response = await client.get(endpoint)
                payload = response.json()
            except Exception:  # 端口还没起来，继续等
                payload = None
            # /json/list 正常返回数组；异常情况下可能返回对象，按"还没就绪"处理
            targets = payload if isinstance(payload, list) else []

            for target in targets:
                if target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
                    return str(target["webSocketDebuggerUrl"])

            if loop.time() >= deadline:
                raise PdfRenderError("启动浏览器超时（调试端口未就绪）")
            await asyncio.sleep(0.2)


def _shutdown(process: Optional[subprocess.Popen]) -> None:
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass


async def render_pdf(
    html: str, *, title: str = "", timeout: float = PRINT_TIMEOUT
) -> bytes:
    """把一份完整的打印用 HTML 渲染成 PDF 字节。"""
    # 找浏览器、写打印文件都是同步阻塞操作（HTML 可达数 MB），放线程里避免卡住事件循环
    browser = await asyncio.to_thread(find_browser)
    work_dir = Path(tempfile.mkdtemp(prefix="localscribe-print-"))
    print_file = work_dir / "print.html"
    await asyncio.to_thread(print_file.write_text, html, "utf-8")

    process: Optional[subprocess.Popen] = None
    try:
        port = _free_port()
        process = subprocess.Popen(
            [
                str(browser),
                *_LAUNCH_FLAGS,
                f"--user-data-dir={work_dir / 'profile'}",
                f"--remote-debugging-port={port}",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        target = await _wait_for_page_target(port, LAUNCH_TIMEOUT)
        try:
            connection = await websockets.connect(
                target, max_size=None, open_timeout=LAUNCH_TIMEOUT
            )
        except Exception as error:  # 浏览器退出 / 端口被拒
            raise PdfRenderError(f"无法连接浏览器调试端口：{error}") from error

        async with connection:
            session = _CdpSession(connection)
            await session.send("Page.enable", timeout=LAUNCH_TIMEOUT)
            await session.send(
                "Page.navigate", {"url": print_file.as_uri()}, timeout=LAUNCH_TIMEOUT
            )
            await session.wait_event("Page.loadEventFired", timeout=LAUNCH_TIMEOUT)
            # 等字体加载完再打印，否则可能整本回退到别的字体
            await session.send(
                "Runtime.evaluate",
                {"expression": "document.fonts.ready", "awaitPromise": True},
                timeout=LAUNCH_TIMEOUT,
            )
            result = await session.send(
                "Page.printToPDF", _print_params(title), timeout=timeout
            )

        data = result.get("data") if isinstance(result, dict) else None
        if not data:
            raise PdfRenderError("浏览器没有返回 PDF 数据")
        return base64.b64decode(data)
    finally:
        _shutdown(process)
        shutil.rmtree(work_dir, ignore_errors=True)
