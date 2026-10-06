"""wbl_p4_01_backfill_politics

政治旧数据回填（Phase 4 P4-T12，politics_ui_design §3.6 旧字段迁移映射、§3.8 政治边落库规则）：

1. 政治子模块 kind 归一化（仅 module_type = 'politics'）：
   - `nation` -> `polity`、`leader` -> `figure`（§3.6 重命名）
   - kind 空缺时按 P1-MIG-04 / app.models.worldbuilding.derive_submodule_kind 同口径
     从 color 前缀推导：`type:nation:*` -> `polity`、`type:organization:*` -> `organization`、
     `type:leader:*` -> `figure`、`type:treaty:*` -> `treaty`，其余 type:* 保留其字面值与旧值
   - 无法识别（非四内置 kind、非 `custom_*`）的旧 generic 数据保留只读并写 `meta.legacy = true`
2. 组织 meta 补 `scope`（§3.8.3）：按 `politics.subordinate_to` / `politics.member_of` 出链
   推导 `intra_polity`（恰好一个政权）/ `cross_polity`（两个及以上政权）；
   只连非政权端点或完全无归属边时**不写猜测值**，写 `meta.legacy = true`
3. 旧 `_char_ref:<charId>` / `_char_link:<itemId>:<charId>` item 键 -> figure 的
   `meta.characterId`（§3.3 / §3.8.5，人物身份不落 WorldLink）；角色不存在、子模块缺失、
   键记在别的 item 上（复制残留）计入 orphan 报告，**不删除旧 item**
4. 旧 `politics.treaty_between` 已废弃（§3.8.1）：本迁移不创建、不查询、不转换任何该类型边
   （文件内只在文档字符串里提到它，代码路径不含写入 / 查询 / 转换）

幂等：所有写入先读现值，只有值变化才 UPDATE；kind 归一化与 characterId 回填仅在缺失/旧值时写。
可重复执行，可在空库与旧库上运行；不改 `color` 原值、不删除任何旧行。
报告：每次 upgrade 打印一次 JSON（`logger.info`），
`legacy_flagged` 只统计本次把 `meta.legacy` 置为 true 的行，`meta_written` 统计 meta 载荷被改写的行。

回滚口径：`meta` 内 `_p4LegacyKind` / `_p4DerivedScope` / `_p4CharacterId` 为本次写入的记账键
（另有 `_p4RawMeta` 保存无法解析的 meta 原文本），downgrade 只在「现值仍等于本次写入的值」时回滚
kind 归一化 / scope / characterId，`meta.legacy` 只清本次新置为 true 的那一次，`meta = '{}'` 保持
`'{}'`（不写成 NULL），无法解析的 meta 原样还原；用户在后迁移期改过的值一律保留，`color` 与旧 item
原值保持不变。

Revision ID: c1f7a4b9e2d3
Revises: 8a5f26a774e3
Create Date: 2026-10-07 09:12:44.000000

"""

import json
import logging
from typing import Any, Dict, Optional, Sequence, Set, Tuple, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1f7a4b9e2d3"
down_revision: Union[str, None] = "8a5f26a774e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

# §3.2 内置四种 kind（自定义 kind 形如 custom_xxx）
POLITICS_KINDS = ("polity", "organization", "figure", "treaty")
CUSTOM_KIND_PREFIX = "custom_"

# §3.6 旧 PoliticalEntityType -> 新 kind
LEGACY_KIND_MAP = {"nation": "polity", "leader": "figure"}

# §3.6 `color = "type:<entityType>:<level>[:<status>]"` 前缀 -> kind（P1 口径 + 政治重命名）
COLOR_TYPE_KIND_MAP = {"nation": "polity", "leader": "figure"}

SCOPE_INTRA = "intra_polity"
SCOPE_CROSS = "cross_polity"
SCOPE_LEGACY_MARKER = "legacy"

# meta 记账键（本次写入专用，downgrade 依据）：
# _p4LegacyKind 记归一化前的 kind（"" 表示原值为空）/ _p4KindWritten 记本次写进 kind 列的值；
# _p4DerivedScope 记本次推导的 scope；_p4RawMeta 只在 meta 原值不是合法 JSON 对象时写入，
# 保存原始文本供 downgrade 原样还原。downgrade 只回滚「现值仍等于本次写入的值」的项。
KIND_MARKER = "_p4LegacyKind"
KIND_WRITTEN_MARKER = "_p4KindWritten"
SCOPE_MARKER = "_p4DerivedScope"
CHARACTER_ID_MARKER = "_p4CharacterId"
RAW_META_MARKER = "_p4RawMeta"

# §3.8.3 归属边：组织 -> 组织 / 政权
CHAR_REF_PREFIX = "_char_ref:"
CHAR_LINK_PREFIX = "_char_link:"


def _parse_json(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _dump_json(value: Dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _load_meta(raw: Any) -> Dict[str, Any]:
    """meta 原值 -> 可写字典（非 JSON 对象一律视为 `{}`）。"""

    parsed = _parse_json(raw, None)
    return parsed if isinstance(parsed, dict) else {}


def _apply_meta(conn, submodule_id: str, meta: Dict[str, Any], report: Dict[str, int]) -> None:
    """meta 落盘：`{}` 也写回 `'{}'`（不能退化成 NULL），并计数本次真正改动的 meta 行。"""

    conn.execute(
        sa.text("UPDATE world_submodules SET meta = :meta WHERE id = :id"),
        {"meta": _dump_json(meta), "id": submodule_id},
    )
    report["meta_written"] += 1


def _is_politics_kind(kind: Any) -> bool:
    return bool(kind) and (
        kind in POLITICS_KINDS or str(kind).startswith(CUSTOM_KIND_PREFIX)
    )


def derive_kind_from_color(color: Any) -> Tuple[Optional[str], bool]:
    """`type:<entityType>:...` 前缀 -> kind；返回 (kind, 前缀是否无法识别)。

    与 P1-MIG-04 的 derive_kind 同口径，另加 §3.6 的 nation/leader 重命名。
    """

    if not color or not str(color).startswith("type:"):
        return None, False
    parts = str(color).split(":")
    entity_type = parts[1] if len(parts) > 1 else ""
    if not entity_type:
        return None, True
    return COLOR_TYPE_KIND_MAP.get(entity_type, entity_type), False


def _normalize_submodule_kind(
    kind: Optional[str], color: Any, meta: Dict[str, Any], report: Dict[str, int]
) -> Optional[str]:
    """kind 归一化，按需写 `meta.legacy` / `meta[KIND_MARKER]`；返回归一化后的 kind。

    `meta[KIND_MARKER]` 记录本次改写前的 kind（`""` 表示改写前为空），
    因此 `nation -> polity`、`leader -> figure` 与「kind 空缺 + color 推导」都可精确回滚。
    `report["legacy_flagged"]` 只在本次把 `meta.legacy` 由非 true 置为 true 时 +1（报告口径）。
    """

    new_kind = kind
    if kind and kind in LEGACY_KIND_MAP:
        new_kind = LEGACY_KIND_MAP[kind]
        report["kind_normalized"] += 1
    elif not kind:
        derived, unknown_prefix = derive_kind_from_color(color)
        if derived:
            new_kind = derived
            report["kind_derived"] += 1
        elif unknown_prefix:
            report["unknown_kind_prefix"] += 1

    if not new_kind:
        # kind 与 color 都无可用信息：保留空缺，不写猜测值
        return kind

    if new_kind != kind:
        # setdefault：只记录第一次改写前的值，重复 upgrade 不覆盖，downgrade 才能精确回滚
        meta.setdefault(KIND_MARKER, kind or "")
        # 记账本次写进 kind 列的值：downgrade 只在这一列仍等于它时才回滚（用户改过则保留现值）
        meta.setdefault(KIND_WRITTEN_MARKER, new_kind)
    if not _is_politics_kind(new_kind):
        if meta.get(SCOPE_LEGACY_MARKER) is not True:
            report["legacy_flagged"] += 1
        meta[SCOPE_LEGACY_MARKER] = True
    return new_kind


def _backfill_submodule_kinds(
    conn, report: Dict[str, int]
) -> Dict[str, Dict[str, Any]]:
    """政治子模块 kind 归一化 + legacy 标记；返回本次写入的记账状态供后续步骤复用。"""

    rows = conn.execute(
        sa.text(
            "SELECT s.id AS id, s.kind AS kind, s.color AS color, s.meta AS meta "
            "FROM world_submodules s JOIN world_modules m ON s.module_id = m.id "
            "WHERE m.module_type = 'politics' ORDER BY s.id"
        )
    ).fetchall()

    states: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        row = row._mapping
        raw_meta = row["meta"]
        parsed = _parse_json(raw_meta, None)
        meta = parsed if isinstance(parsed, dict) else {}
        original = json.loads(json.dumps(meta))  # 浅拷贝快照，用于判断是否落盘
        new_kind = _normalize_submodule_kind(row["kind"], row["color"], meta, report)

        if new_kind != row["kind"]:
            conn.execute(
                sa.text("UPDATE world_submodules SET kind = :kind WHERE id = :id"),
                {"kind": new_kind, "id": row["id"]},
            )
        if meta != original:
            _apply_meta(conn, row["id"], meta, report)
        elif raw_meta is not None and not isinstance(parsed, dict):
            # meta 原值不是合法 JSON 对象（NULL 不算：NULL 保持 NULL）：
            # 整体替换为只含记账键的对象，原始文本存进 `_p4RawMeta`，
            # downgrade 才能原样还原（否则旧值不可恢复）
            report["malformed_meta"] += 1
            meta = {RAW_META_MARKER: raw_meta}
            _apply_meta(conn, row["id"], meta, report)
        states[row["id"]] = {"_meta": meta}
    return states


def _scope_of(conn, organization_id: str) -> Optional[str]:
    """§3.8.3 归属边推导 scope：只有「不同政权数」决定结果。

    0 个政权（无归属边或只连非政权端点）-> None（不猜、标 legacy）；恰好 1 个 -> intra_polity；
    2 个及以上 -> cross_polity。端点是否含组织不影响判定（与前端 deriveScope 同口径）。
    """

    rows = conn.execute(
        sa.text(
            "SELECT target_module, target_kind, target_id FROM world_links "
            "WHERE source_module = 'politics' AND source_id = :id "
            "AND link_type IN ('politics.subordinate_to', 'politics.member_of') "
            "ORDER BY target_id"
        ),
        {"id": organization_id},
    ).fetchall()
    if not rows:
        return None

    polity_ids: Set[str] = set()
    for row in rows:
        row = row._mapping
        if row["target_module"] == "politics" and row["target_kind"] == "polity":
            polity_ids.add(row["target_id"])
    if not polity_ids:
        return None
    if len(polity_ids) == 1:
        return SCOPE_INTRA
    return SCOPE_CROSS


def _backfill_organization_scope(
    conn, politics_meta: Dict[str, Dict[str, Any]], report: Dict[str, int]
) -> None:
    rows = conn.execute(
        sa.text(
            "SELECT s.id AS id, s.kind AS kind, s.meta AS meta "
            "FROM world_submodules s JOIN world_modules m ON s.module_id = m.id "
            "WHERE m.module_type = 'politics' AND s.kind = 'organization' ORDER BY s.id"
        )
    ).fetchall()

    for row in rows:
        row = row._mapping
        state = politics_meta.setdefault(row["id"], {"_meta": {}})
        meta = _load_meta(row["meta"])
        if state["_meta"]:
            # 已由第 1 步写过 meta（如 legacy 标记）：以记账状态为准，避免覆盖记账键
            meta = state["_meta"]
        state["_meta"] = meta
        original = json.loads(json.dumps(meta))  # 快照：本次未改动则不落盘（保持幂等）
        if meta.get("scope"):
            # 已有 scope（用户或更早的迁移写入）：不覆盖
            continue

        derived = _scope_of(conn, row["id"])
        if derived is None:
            # 政权归属边无法判定（0 个政权端点）-> 不写猜测值，保留只读并标 legacy
            if meta.get(SCOPE_LEGACY_MARKER) is not True:
                report["legacy_flagged"] += 1
            meta[SCOPE_LEGACY_MARKER] = True
            report["scope_legacy"] += 1
        else:
            meta["scope"] = derived
            meta[SCOPE_MARKER] = derived  # 记账，downgrade 精确回滚
            report["scope_filled"] += 1

        if meta != original:
            _apply_meta(conn, row["id"], meta, report)


def _char_ref_entries(
    content: Any, item_id: str, report: Dict[str, int]
) -> list:
    """从 item.content 解析 (来源键, charId)；复制残留与残缺键只计数，不归属。

    content 不是合法 JSON 对象（`'not-json'` / 数组 / `null`）时无法判定是否含旧引用键，
    计入 `malformed_item_content`，不归属、不改写旧 item。
    """

    parsed = _parse_json(content, None)
    if not isinstance(parsed, dict):
        report["malformed_item_content"] += 1
        return []

    entries = []
    for key in sorted(parsed):
        if key.startswith(CHAR_REF_PREFIX):
            char_id = key[len(CHAR_REF_PREFIX) :]
            if not char_id:
                report["orphan_char_refs"] += 1
                continue
            entries.append(("_char_ref", char_id))
        elif key.startswith(CHAR_LINK_PREFIX):
            suffix = key[len(CHAR_LINK_PREFIX) :]
            colon = suffix.find(":")
            if colon <= 0 or colon == len(suffix) - 1:
                report["orphan_char_links"] += 1
                continue
            linked_item_id, char_id = suffix[:colon], suffix[colon + 1 :]
            if linked_item_id != item_id:
                # 键写在别的 item 上（复制/粘贴残留），无法归属
                report["skipped_foreign_char_links"] += 1
                continue
            entries.append(("_char_link", char_id))
    return entries


def _backfill_character_ids(
    conn, politics_meta: Dict[str, Dict[str, Any]], report: Dict[str, int]
) -> None:
    character_ids = {
        row._mapping["id"]
        for row in conn.execute(sa.text("SELECT id FROM characters")).fetchall()
    }
    # 归一化后的 kind：本迁移先写 kind 再读，故直接查库
    submodules = {
        row._mapping["id"]: row._mapping["kind"]
        for row in conn.execute(
            sa.text(
                "SELECT s.id AS id, s.kind AS kind FROM world_submodules s "
                "JOIN world_modules m ON s.module_id = m.id "
                "WHERE m.module_type = 'politics'"
            )
        ).fetchall()
    }

    rows = conn.execute(
        sa.text(
            "SELECT i.id AS id, i.submodule_id AS submodule_id, i.content AS content "
            "FROM world_module_items i JOIN world_modules m ON i.module_id = m.id "
            "WHERE m.module_type = 'politics' ORDER BY i.id"
        )
    ).fetchall()

    for row in rows:
        row = row._mapping
        entries = _char_ref_entries(row["content"], row["id"], report)
        if not entries:
            continue

        submodule_id = row["submodule_id"]
        if not submodule_id or submodule_id not in submodules:
            # 子模块缺失：无法归属
            for source, _char_id in entries:
                report[
                    "orphan_char_refs" if source == "_char_ref" else "orphan_char_links"
                ] += 1
            continue
        if submodules[submodule_id] != "figure":
            # 人物身份键只回填 figure；其余 kind 保留旧 item 只读
            report["char_refs_not_on_figure"] += len(entries)
            continue

        state = politics_meta.setdefault(submodule_id, {"_meta": {}})
        state.setdefault(
            "_existing_character_id", state["_meta"].get("characterId") is not None
        )
        current_meta = state["_meta"]
        owner = state.get("_patched_character_id") or current_meta.get("characterId")

        for source, char_id in entries:
            if char_id not in character_ids:
                report[
                    "orphan_char_refs" if source == "_char_ref" else "orphan_char_links"
                ] += 1
                continue
            if owner is None:
                # 首次回填：submodule 自身 meta 里没有 characterId
                owner = char_id
                if not state["_existing_character_id"]:
                    state["_patched_character_id"] = char_id
            elif owner != char_id:
                # 同一 figure 上多个不同 charId：只保留首个，其余只读不落库
                report["char_refs_not_on_figure"] += 1

        if state.get("_patched_character_id") and current_meta.get("characterId") is None:
            current_meta["characterId"] = state["_patched_character_id"]
            current_meta[CHARACTER_ID_MARKER] = state["_patched_character_id"]
            _apply_meta(conn, submodule_id, current_meta, report)
            report["character_id_backfilled"] += 1


def upgrade() -> None:
    conn = op.get_bind()
    report: Dict[str, int] = {
        "kind_normalized": 0,
        "kind_derived": 0,
        "unknown_kind_prefix": 0,
        # legacy_flagged 只统计「本次把 meta.legacy 置为 true」的行；
        # meta_written 统计本次真正改写过 meta 载荷的行（两类都可能为 0）
        "legacy_flagged": 0,
        "meta_written": 0,
        "malformed_meta": 0,
        "malformed_item_content": 0,
        "scope_filled": 0,
        "scope_legacy": 0,
        "character_id_backfilled": 0,
        "orphan_char_refs": 0,
        "orphan_char_links": 0,
        "skipped_foreign_char_links": 0,
        "char_refs_not_on_figure": 0,
    }

    # 1) 政治子模块 kind 归一化 + legacy 标记
    politics_meta = _backfill_submodule_kinds(conn, report)

    # 2) 组织 scope 推导（依赖已归一化的 kind 与 world_links 归属边）
    _backfill_organization_scope(conn, politics_meta, report)

    # 3) 旧人物引用键 -> figure.meta.characterId
    _backfill_character_ids(conn, politics_meta, report)

    # 报告语义：legacy_flagged 只数「本次把 meta.legacy 置为 true」的行；
    # meta_written 数本次真正改写过 meta 载荷的行（两者都以行计，不是以写入次数计）
    logger.info(
        "wbl_p4_01_backfill_politics report: %s",
        json.dumps(report, ensure_ascii=False, sort_keys=True),
    )


def _downgrade_submodule_kinds(conn) -> None:
    """回滚 kind 归一化 / `meta.legacy` / `meta.characterId`，并还原无法解析的 meta 原文本。

    每一项都只在「现值仍等于本次写入的值」时撤销：用户改过的 kind / legacy / characterId 一律保留。
    `meta` 为空对象时写回 `'{}'`（不是 NULL），与真实存量库（`meta = '{}'`）保持同一形态。
    """

    rows = conn.execute(
        sa.text(
            "SELECT s.id AS id, s.kind AS kind, s.meta AS meta "
            "FROM world_submodules s JOIN world_modules m ON s.module_id = m.id "
            "WHERE m.module_type = 'politics' ORDER BY s.id"
        )
    ).fetchall()

    for row in rows:
        row = row._mapping
        raw_meta = row["meta"]
        parsed = _parse_json(raw_meta, None)
        if not isinstance(parsed, dict):
            continue
        meta = parsed
        changed = False

        if RAW_META_MARKER in meta:
            # meta 原值不是 JSON 对象：本次 upgrade 用记账键整体替换过，原样写回原始文本
            original_raw = meta.pop(RAW_META_MARKER)
            changed = True
            if not meta:
                conn.execute(
                    sa.text("UPDATE world_submodules SET meta = :meta WHERE id = :id"),
                    {"meta": original_raw, "id": row["id"]},
                )
                continue

        if KIND_MARKER in meta:
            legacy_kind = meta.pop(KIND_MARKER)
            # 只回滚「kind 列仍等于本次写入的归一化值」的行；用户改过 kind 则保留现值。
            # 记账键缺失时保守跳过（宁可少回滚，不覆盖用户值）。
            if meta.get(KIND_WRITTEN_MARKER) == row["kind"]:
                conn.execute(
                    sa.text("UPDATE world_submodules SET kind = :kind WHERE id = :id"),
                    {"kind": legacy_kind or None, "id": row["id"]},
                )
            meta.pop(KIND_WRITTEN_MARKER, None)
            changed = True

        if SCOPE_LEGACY_MARKER in meta:
            previous = meta.pop(SCOPE_LEGACY_MARKER)
            if previous is not True:
                # 非本次置为 true 的旧值（如 `legacy: false`）：原值写回
                meta[SCOPE_LEGACY_MARKER] = previous
            changed = True

        if CHARACTER_ID_MARKER in meta:
            written_character_id = meta.pop(CHARACTER_ID_MARKER)
            if meta.get("characterId") == written_character_id:
                # 现值仍是本次回填的 charId 才删除；用户改过则保留现值
                meta.pop("characterId", None)
            changed = True

        if changed:
            conn.execute(
                sa.text("UPDATE world_submodules SET meta = :meta WHERE id = :id"),
                {"meta": _dump_json(meta), "id": row["id"]},
            )


def _downgrade_organization_scope(conn) -> None:
    rows = conn.execute(
        sa.text(
            "SELECT id, meta FROM world_submodules WHERE json_extract(meta, '$.scope') "
            "IS NOT NULL"
        )
    ).fetchall()

    for row in rows:
        row = row._mapping
        meta = _parse_json(row["meta"], None)
        if not isinstance(meta, dict):
            continue
        derived = meta.get(SCOPE_MARKER)
        if derived is None:
            continue
        if meta.get("scope") == derived:
            # 现值仍是本次写入的推导值才回滚；用户改过则保留现值
            meta.pop("scope", None)
        # 记账键属于本次写入的内部状态，无论是否回滚 scope 都一并清除
        meta.pop(SCOPE_MARKER, None)
        conn.execute(
            sa.text("UPDATE world_submodules SET meta = :meta WHERE id = :id"),
            {"meta": _dump_json(meta), "id": row["id"]},
        )


def downgrade() -> None:
    """只撤销本次写入：kind 归一化、scope、figure.characterId、meta.legacy 标记。

    不改 `color` 原值、不删除旧 item、不触碰 world_links（本迁移不写关联）；
    用户在后迁移期改过的 kind / scope / characterId / legacy 一律保留。
    """

    conn = op.get_bind()
    _downgrade_organization_scope(conn)
    _downgrade_submodule_kinds(conn)
