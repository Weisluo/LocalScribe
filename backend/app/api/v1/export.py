"""导出接口。

PDF 走本机 Chromium 内核浏览器打印（见 ``app.services.pdf_service``）：
前端按导出模型生成打印用 HTML，后端只负责把它打印成 PDF 并回传。
DOCX / EPUB / TXT 仍然是前端直接产出文件，不经过这里。
"""

from __future__ import annotations

from html.parser import HTMLParser
from typing import List, Optional, Sequence, Tuple
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.services.pdf_service import PdfBrowserUnavailable, PdfRenderError, render_pdf

logger = get_logger(__name__)

router = APIRouter()

# 打印用 HTML 的上限（一部长篇大约 1~2MB，留足余量）
MAX_PRINT_HTML_CHARS = 32 * 1024 * 1024

# 打印 HTML 只由本项目前端模板生成，所以可以严格白名单：只放行模板实际用到的标签与属性。
#
# 为什么需要这一步：页面是以 file:// 打开的，任何能执行的脚本都能读本地文件，
# 并把内容渲染进返回的 PDF。只查字面量 "<script" 挡不住注入——
# `<img src=x onerror=...>`、`<svg onload=...>`、事件属性、`<iframe>` 一样会执行。
ALLOWED_TAGS = frozenset(
    {
        "html",
        "head",
        "meta",
        "title",
        "style",
        "body",
        "section",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "strong",
        "em",
        "span",
        "blockquote",
        "pre",
        "br",
    }
)
ALLOWED_ATTRIBUTES = frozenset({"lang", "charset", "class", "style"})

# 模板的 CSS 只写内联编排参数；出现这些说明不是模板产物（会让 headless 浏览器去请求外部资源）
FORBIDDEN_CSS_TOKENS = ("url(", "@import", "expression(", "javascript:", "\\")


class _PrintHtmlValidator(HTMLParser):
    """白名单校验：收集所有不在白名单里的标签与属性。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.violations: List[str] = []
        self._in_style = 0

    def handle_starttag(
        self, tag: str, attrs: Sequence[Tuple[str, Optional[str]]]
    ) -> None:
        self._check(tag, attrs)
        if tag == "style":
            self._in_style += 1

    def handle_startendtag(
        self, tag: str, attrs: Sequence[Tuple[str, Optional[str]]]
    ) -> None:
        self._check(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag == "style" and self._in_style > 0:
            self._in_style -= 1

    def handle_data(self, data: str) -> None:
        if self._in_style > 0 and self._contains_forbidden_css(data):
            self.violations.append("<style> 内容")

    def _check(self, tag: str, attrs: Sequence[Tuple[str, Optional[str]]]) -> None:
        if tag not in ALLOWED_TAGS:
            self.violations.append(f"<{tag}>")
            return
        for name, value in attrs:
            if name not in ALLOWED_ATTRIBUTES:
                self.violations.append(f"<{tag} {name}=...>")
            elif name == "style" and self._contains_forbidden_css(value or ""):
                self.violations.append(f"<{tag} style=...>")

    @staticmethod
    def _contains_forbidden_css(value: str) -> bool:
        return any(token in value for token in FORBIDDEN_CSS_TOKENS)


def ensure_print_html_is_safe(html: str) -> None:
    """打印 HTML 不在白名单内就拒绝，而不是静默剥离（否则会悄悄改掉调用方的内容）。"""
    validator = _PrintHtmlValidator()
    validator.feed(html)
    validator.close()
    if validator.violations:
        unique = sorted(set(validator.violations))
        raise HTTPException(
            status_code=400,
            detail="打印内容包含不支持的标签或属性：" + "、".join(unique[:5]),
        )


class PdfExportRequest(BaseModel):
    """打印用 HTML 与文件信息。"""

    html: str = Field(..., min_length=1, max_length=MAX_PRINT_HTML_CHARS)
    title: str = Field(default="", max_length=200)
    filename: str = Field(default="导出.pdf", max_length=200)


@router.post("/pdf", summary="导出 PDF（浏览器打印）")
async def export_pdf(payload: PdfExportRequest) -> Response:
    ensure_print_html_is_safe(payload.html)

    try:
        pdf = await render_pdf(payload.html, title=payload.title)
    except PdfBrowserUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except PdfRenderError as error:
        logger.error("PDF 打印失败: %s", error)
        raise HTTPException(status_code=502, detail=f"PDF 打印失败：{error}") from error

    # quote 默认不编码 "/"，而 RFC 5987 的 filename* 只允许 attr-char，这里全部编码
    filename = quote(payload.filename or "导出.pdf", safe="")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
