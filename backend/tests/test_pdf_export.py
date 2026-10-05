"""PDF 导出（浏览器打印）的回归用例。

覆盖两件事：
1. 打印服务能产出**带文字层**的矢量 PDF——页数、体积、ToUnicode 映射、页脚页码；
2. 找不到浏览器时给出可读错误，接口据此返回 503。

真正的排版与分页由本机 Edge/Chrome 完成，所以只有前两个用例需要 Chromium 内核
浏览器，找不到时单独跳过（`PDF_BROWSER_PATH` 可指定路径）。
"""

from __future__ import annotations

import asyncio
import re
import zlib

import pytest

from app.services.pdf_service import PdfBrowserUnavailable, find_browser, render_pdf

# 正文刻意不含“第”“页”两个字：PDF 里出现它们只可能来自页脚模板
PARAGRAPH = "山间的雾气在清晨慢慢散去，远处的檐角露出一点轮廓。" * 4

PRINT_HTML = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>回归书</title>
<style>
  @page { size: A4; }
  body { font-family: SimSun, serif; font-size: 13.5px; line-height: 1.8; margin: 0; }
  p { margin: 0 0 1em; text-indent: 2em; }
  .cover { break-after: page; text-align: center; margin-top: 38%; }
  .chapter { break-before: page; }
</style></head>
<body>
<section class="cover"><h1>回归书</h1></section>
<section class="chapter"><h1>第一章 起点</h1>{first}</section>
<section class="chapter"><h1>第二章 继续</h1>{second}</section>
</body></html>
"""


def _has_browser() -> bool:
    try:
        find_browser()
    except PdfBrowserUnavailable:
        return False
    return True


# 只有真正打印的用例需要浏览器；校验类用例在无浏览器环境下也必须运行
requires_browser = pytest.mark.skipif(
    not _has_browser(), reason="本机没有可用的 Edge/Chrome"
)


def _page_count(pdf: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page[^s]", pdf))


def _text_layer(pdf: bytes) -> tuple[set[int], int, int]:
    """从 ToUnicode CMap 收集所有码位（证明文字层存在），并统计文本绘制指令。"""
    codepoints: set[int] = set()
    text_ops = 0
    cmaps = 0

    for match in re.finditer(rb"stream\r?\n", pdf):
        start = match.end()
        end = pdf.find(b"endstream", start)
        if end < 0:
            continue
        try:
            data = zlib.decompress(pdf[start:end])
        except zlib.error:
            continue

        text_ops += len(re.findall(rb"\bTJ\b|\bTj\b", data))
        if b"beginbfchar" not in data and b"beginbfrange" not in data:
            continue

        cmaps += 1
        for chunk in re.findall(rb"<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]{4,})>", data):
            for offset in range(0, len(chunk[1]), 4):
                codepoints.add(int(chunk[1][offset : offset + 4], 16))

    return codepoints, text_ops, cmaps


def _print() -> bytes:
    html = PRINT_HTML.replace("{first}", f"<p>{PARAGRAPH}</p>" * 4).replace(
        "{second}", f"<p>{PARAGRAPH}</p>" * 4
    )
    return asyncio.run(render_pdf(html, title="回归书"))


@requires_browser
def test_pdf_is_vector_with_text_layer():
    """封面 + 每章一页；PDF 里必须有可提取的文字（不是整页图片）。"""
    pdf = _print()

    assert pdf.startswith(b"%PDF"), "不是合法的 PDF"
    assert pdf.rstrip().endswith(b"%%EOF")

    pages = _page_count(pdf)
    assert pages == 3, f"封面 + 两章应为 3 页，实际 {pages} 页"

    # 光栅方案每页是一张 JPEG；矢量方案不应再有整页图像
    assert b"/DCTDecode" not in pdf, "PDF 里仍然出现了 JPEG 图像流"

    codepoints, text_ops, cmaps = _text_layer(pdf)
    assert text_ops > 0, "没有任何文本绘制指令"
    assert cmaps > 0, "没有 ToUnicode 映射，PDF 无法搜索/复制"
    assert 0x5C71 in codepoints, "正文里的“山”没有进入文字层"
    # 页脚模板写的“第 N 页”只能来自页脚
    assert 0x7B2C in codepoints and 0x9875 in codepoints, "页脚页码没有渲染"


@requires_browser
def test_pdf_size_per_page_is_small():
    """矢量化之后每页只要几十 KB——旧的光栅方案是 135~230KB/页。"""
    pdf = _print()
    per_page_kb = len(pdf) / _page_count(pdf) / 1024
    assert per_page_kb < 60, f"每页 {per_page_kb:.1f}KB，明显偏大"


def test_missing_browser_raises_readable_error(monkeypatch):
    """找不到浏览器时，抛出的错误要能直接给用户看。"""
    monkeypatch.setattr(
        "app.services.pdf_service.settings.PDF_BROWSER_PATH",
        "Z:/definitely/missing/browser.exe",
    )
    # 只清掉探测用的环境变量，不替换整个 os.environ（那是标准库模块的属性，影响进程全局）
    for variable in (
        "PROGRAMFILES(X86)",
        "PROGRAMFILES",
        "LOCALAPPDATA",
        "LOCALSCRIBE_PDF_BROWSER",
    ):
        monkeypatch.setenv(variable, "")
    monkeypatch.setattr("app.services.pdf_service.shutil.which", lambda name: None)

    with pytest.raises(PdfBrowserUnavailable) as error:
        find_browser()

    assert "PDF_BROWSER_PATH" in str(error.value)
