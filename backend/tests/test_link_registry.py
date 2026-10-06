"""link_registry 与设计文档第 4 节的一致性测试（纯 Python，不依赖数据库）。"""

from __future__ import annotations

import re
from pathlib import Path

from app.services.link_registry import (
    GENERAL_LINK_TYPE_IDS,
    LINK_TYPES,
    LINK_TYPES_BY_ID,
    LinkTypeDef,
    get_link_type,
    is_general_link_type,
    link_type_ids,
    validate_link_type,
)

DOC_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "worldbuilding"
    / "cross_module_link_design.md"
)
SECTION_4_START = "## 4. 关联类型注册表（核心集）"
SECTION_5_PREFIX = "## 5."

ID_CELL_RE = re.compile(r"[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*")
ICON_RE = re.compile(r"[a-z][a-z0-9]*(-[a-z0-9]+)*")
LEADING_WORD_RE = re.compile(r"[a-z]+")

LINE_STYLES = {"solid", "dashed", "dotted", "double"}

# 文档 4.1-4.7 各节条目数：3 + 5 + 14 + 12 + 8 + 9 + 3 = 54
EXPECTED_GROUP_COUNTS = {
    "core": 3,
    "history": 5,
    "politics": 14,
    "economy": 12,
    "races": 8,
    "systems": 9,
    "character": 3,
}

UNDIRECTED_IDS = (
    "core.related_to",
    "politics.ally_of",
    "politics.at_war_with",
    "politics.trades_with",
    "politics.marriage_tie",
    "races.related_to",
    "systems.countered_by",
)

DIRECTED_IDS = (
    "history.occurs_at",
    "history.involves",
    "politics.member_of",
    "economy.produces",
    "races.inhabits",
    "systems.advances_to",
    "character.appears_in",
)


def _section_4_lines() -> list[str]:
    """读取文档第 4 节的所有行（到第 5 节标题为止）。"""
    lines = DOC_PATH.read_text(encoding="utf-8").splitlines()
    start = next(
        index for index, line in enumerate(lines) if line.startswith(SECTION_4_START)
    )
    end = next(
        index
        for index, line in enumerate(lines)
        if index > start and line.startswith(SECTION_5_PREFIX)
    )
    return lines[start:end]


def _doc_rows() -> list[tuple[str, list[str]]]:
    """解析第 4 节表格，返回 (id, 单元格) 列表，保持文档顺序。"""
    rows: list[tuple[str, list[str]]] = []
    for line in _section_4_lines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if cells and ID_CELL_RE.fullmatch(cells[0]):
            rows.append((cells[0], cells))
    return rows


def _visual_columns(cells: list[str]) -> dict[str, str]:
    """按表格列数定位视觉列；4.1-4.6 表格有 reverseLabel 列，4.7 表格没有。"""
    if len(cells) == 8:
        keys = (
            "reverse_label",
            "source_target",
            "direction",
            "icon",
            "color",
            "line_style",
        )
    elif len(cells) == 7:
        keys = ("source_target", "direction", "icon", "color", "line_style")
    else:
        raise AssertionError(f"表格列数异常（{len(cells)} 列）：{cells}")
    return dict(zip(keys, cells[2:]))


def _doc_directed(direction_cell: str) -> bool:
    """契约方向列 -> 是否有向（↔ 为对称关联）。"""
    return "↔" not in direction_cell


def _concrete(refs: frozenset[tuple[str, str]]) -> tuple[str, str]:
    """把 (module, kind) 集合展开为一个具体引用，"*" 用样例 kind 代替。"""
    module, kind = sorted(refs)[0]
    return module, "sample" if kind == "*" else kind


def test_doc_source_exists() -> None:
    assert DOC_PATH.is_file(), f"未找到设计文档：{DOC_PATH}"


def test_registry_ids_match_document_rows() -> None:
    doc_ids = [row_id for row_id, _ in _doc_rows()]
    assert len(doc_ids) == 54, f"文档第 4 节应有 54 条关联类型，实际 {len(doc_ids)}"
    assert len(set(doc_ids)) == len(doc_ids), "文档表格存在重复 id"
    assert doc_ids == list(link_type_ids()), "注册表顺序必须与文档表格一致"
    assert len(LINK_TYPES) == 54, f"注册表应有 54 条，实际 {len(LINK_TYPES)}"
    assert len(LINK_TYPES_BY_ID) == len(LINK_TYPES), "注册表存在重复 id"
    assert set(LINK_TYPES_BY_ID) == set(doc_ids)


def test_deprecated_treaty_between_is_not_usable() -> None:
    """politics.treaty_between 已废弃，不得出现在文档表格与注册表中。"""
    assert "politics.treaty_between" not in [row_id for row_id, _ in _doc_rows()]
    assert "politics.treaty_between" not in LINK_TYPES_BY_ID
    assert "politics.treaty_between" not in link_type_ids()
    assert get_link_type("politics.treaty_between") is None
    ok, message = validate_link_type(
        "politics.treaty_between", "politics", "polity", "politics", "polity"
    )
    assert ok is False
    assert message


def test_entry_fields_are_complete_and_uniform() -> None:
    for entry in LINK_TYPES:
        assert isinstance(entry, LinkTypeDef)
        assert entry.id.strip(), "id 不能为空"
        assert entry.label.strip(), f"{entry.id} 缺少 label"
        assert entry.reverse_label.strip(), f"{entry.id} 缺少 reverse_label"
        assert isinstance(entry.directed, bool), f"{entry.id} 的 directed 必须是布尔值"
        assert entry.icon.strip(), f"{entry.id} 缺少 icon"
        assert entry.color.strip(), f"{entry.id} 缺少 color"
        assert entry.line_style in LINE_STYLES, f"{entry.id} 线型非法"
        assert entry.group in EXPECTED_GROUP_COUNTS, f"{entry.id} group 非法"
        assert ICON_RE.fullmatch(entry.icon), f"{entry.id} 图标必须是 kebab-case"
        assert entry.icon.isascii(), f"{entry.id} 图标不得包含非 ASCII 字符（含 emoji）"
        assert entry.color.isascii(), f"{entry.id} color 必须是 ASCII 色名"
        if entry.source is not None:
            assert isinstance(entry.source, frozenset)
            assert entry.source, f"{entry.id} 的 source 不能是空集合"
        if entry.target is not None:
            assert isinstance(entry.target, frozenset)
            assert entry.target, f"{entry.id} 的 target 不能是空集合"


def test_document_columns_match_registry_fields() -> None:
    for row_id, cells in _doc_rows():
        entry = LINK_TYPES_BY_ID[row_id]
        columns = _visual_columns(cells)
        assert cells[1] == entry.label, row_id
        assert columns["icon"] == entry.icon, row_id
        assert columns["color"] == entry.color, row_id
        match = LEADING_WORD_RE.match(columns["line_style"])
        assert match is not None, f"{row_id} 线型列无法解析：{columns['line_style']}"
        assert match.group(0) == entry.line_style, row_id
        assert _doc_directed(columns["direction"]) is entry.directed, row_id
        if "reverse_label" in columns:
            assert columns["reverse_label"] == entry.reverse_label, row_id


def test_group_counts_follow_document_sections() -> None:
    counts: dict[str, int] = {}
    for entry in LINK_TYPES:
        counts[entry.group] = counts.get(entry.group, 0) + 1
    assert counts == EXPECTED_GROUP_COUNTS


def test_general_link_types() -> None:
    assert GENERAL_LINK_TYPE_IDS == (
        "core.references",
        "core.related_to",
        "custom.link",
    )
    general = [entry for entry in LINK_TYPES if is_general_link_type(entry.id)]
    assert [entry.id for entry in general] == list(GENERAL_LINK_TYPE_IDS)
    for entry in general:
        assert entry.source is None, entry.id
        assert entry.target is None, entry.id
    assert is_general_link_type("history.occurs_at") is False


def test_general_link_types_accept_arbitrary_kinds() -> None:
    for link_type_id in GENERAL_LINK_TYPE_IDS:
        ok, message = validate_link_type(
            link_type_id, "economy", "market", "character", "character"
        )
        assert ok is True, link_type_id
        assert message is None


def test_directed_flags() -> None:
    for link_type_id in UNDIRECTED_IDS:
        entry = get_link_type(link_type_id)
        assert entry is not None, link_type_id
        assert entry.directed is False, link_type_id
        assert entry.source == entry.target, f"{link_type_id} 为对称关联，源/目标应同左"
    for link_type_id in DIRECTED_IDS:
        entry = get_link_type(link_type_id)
        assert entry is not None, link_type_id
        assert entry.directed is True, link_type_id


def test_validate_link_type_accepts_declared_pair() -> None:
    ok, message = validate_link_type(
        "history.occurs_at", "history", "era", "map", "region"
    )
    assert ok is True
    assert message is None


def test_validate_link_type_rejects_wrong_source_module() -> None:
    ok, message = validate_link_type(
        "history.occurs_at", "economy", "market", "map", "region"
    )
    assert ok is False
    assert message is not None
    assert "history.occurs_at" in message


def test_validate_link_type_rejects_wrong_target_kind() -> None:
    ok, message = validate_link_type(
        "history.occurs_at", "history", "event", "systems", "system"
    )
    assert ok is False
    assert message is not None
    assert "history.occurs_at" in message


def test_wildcard_kind_matches_any_kind_in_module() -> None:
    assert validate_link_type(
        "economy.located_in", "economy", "industry", "map", "region"
    ) == (True, None)
    assert validate_link_type(
        "economy.located_in", "economy", "institution", "map", "location"
    ) == (True, None)
    ok, message = validate_link_type(
        "economy.located_in", "history", "event", "map", "region"
    )
    assert ok is False
    assert message is not None


def test_unknown_link_type_is_rejected() -> None:
    ok, message = validate_link_type(
        "nope.unknown", "history", "event", "map", "region"
    )
    assert ok is False
    assert message is not None
    assert "nope.unknown" in message
    assert get_link_type("nope.unknown") is None


def test_every_registered_type_accepts_its_own_declared_pair() -> None:
    for entry in LINK_TYPES:
        if entry.source is None or entry.target is None:
            continue
        source_module, source_kind = _concrete(entry.source)
        target_module, target_kind = _concrete(entry.target)
        ok, message = validate_link_type(
            entry.id, source_module, source_kind, target_module, target_kind
        )
        assert ok is True, f"{entry.id} 自校验失败：{message}"
