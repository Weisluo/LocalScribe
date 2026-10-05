"""导出接口的输入校验与状态码映射。

这些用例都不启动浏览器：非法输入在打印之前就被拒绝，
其余分支通过替换 ``render_pdf`` 来验证状态码映射。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.v1.export import ensure_print_html_is_safe
from app.main import app
from app.services.pdf_service import PdfBrowserUnavailable, PdfRenderError

client = TestClient(app)

# 前端模板实际产出的 HTML 结构，必须被放行
TEMPLATE_HTML = (
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>'
    "<title>书</title><style>@page { size: A4; } p { margin: 0 0 1em; }</style></head>"
    '<body><section class="cover"><h1 class="cover-title">书</h1></section>'
    '<p class="list-item" style="margin-left: 3em">· 项</p>'
    "<pre>code</pre><blockquote>引用</blockquote><br/>"
    '<strong>粗</strong><em>斜</em><span class="strike">删</span></body></html>'
)


def _post(html: str, **extra: str):
    return client.post(
        "/api/v1/export/pdf", json={"html": html, "title": "校验", **extra}
    )


def test_template_html_passes_whitelist():
    """模板 HTML 不能被白名单误拒，否则正常导出会变成 400。"""
    ensure_print_html_is_safe(TEMPLATE_HTML)


@pytest.mark.parametrize(
    "html",
    [
        "<script>alert(1)</script>",
        '<img src=x onerror="alert(1)">',
        '<svg onload="alert(1)"></svg>',
        '<iframe src="file:///C:/Windows/win.ini"></iframe>',
        '<p onclick="alert(1)">x</p>',
        '<a href="javascript:alert(1)">x</a>',
        '<p style="background: url(http://example.com/x)">x</p>',
        "<style>@import url(http://example.com/x.css);</style>",
        "<style>body { background: \\75 rl(http://example.com/x) }</style>",
        '<meta http-equiv="refresh" content="0;url=http://example.com"/>',
    ],
)
def test_unsafe_print_html_is_rejected(html: str):
    """只查字面量 <script 挡不住的那些写法，这里逐一拒绝。"""
    response = _post(html)

    assert response.status_code == 400
    assert "打印内容包含不支持的标签或属性" in response.json()["detail"]


def test_rejected_payload_names_the_offending_tag():
    response = _post('<img src=x onerror="alert(1)">')

    assert response.status_code == 400
    assert "<img>" in response.json()["detail"]


def test_browser_unavailable_maps_to_503(monkeypatch: pytest.MonkeyPatch):
    async def unavailable(*args: object, **kwargs: object) -> bytes:
        raise PdfBrowserUnavailable("未找到 Microsoft Edge 或 Google Chrome")

    monkeypatch.setattr("app.api.v1.export.render_pdf", unavailable)
    response = _post("<p>正文</p>")

    assert response.status_code == 503
    assert "Edge" in response.json()["detail"]


def test_render_failure_maps_to_502(monkeypatch: pytest.MonkeyPatch):
    async def failing(*args: object, **kwargs: object) -> bytes:
        raise PdfRenderError("printToPDF 超时")

    monkeypatch.setattr("app.api.v1.export.render_pdf", failing)
    response = _post("<p>正文</p>")

    assert response.status_code == 502
    assert "超时" in response.json()["detail"]


def test_utf8_filename_is_percent_encoded(monkeypatch: pytest.MonkeyPatch):
    async def ok(*args: object, **kwargs: object) -> bytes:
        return b"%PDF-1.4\n"

    monkeypatch.setattr("app.api.v1.export.render_pdf", ok)
    response = _post("<p>正文</p>", filename="报告 2024.pdf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == (
        "attachment; filename*=UTF-8''%E6%8A%A5%E5%91%8A%202024.pdf"
    )
