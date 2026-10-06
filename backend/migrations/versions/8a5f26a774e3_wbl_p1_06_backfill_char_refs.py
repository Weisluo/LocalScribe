"""wbl_p1_06_backfill_char_refs

旧人物引用回填 world_links（Phase 0 §6.1 P1-MIG-06，契约 §4.7）：
- item.content 的 `_char_ref:<charId>` 键 -> character.appears_in（character -> 所属 history.event 子模块）
- item.content 的 `_char_link:<itemId>:<charId>` 键 -> 同上，meta 记 itemId
不删除旧 item；角色不存在、子模块缺失、模块缺失时计入孤儿报告。

Revision ID: 8a5f26a774e3
Revises: 2160f6984e8a
Create Date: 2026-10-06 17:59:50.690778

"""

import json
import logging
import uuid
from typing import Any, Dict, Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8a5f26a774e3"
down_revision: Union[str, None] = "2160f6984e8a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

NAMESPACE = uuid.UUID("6f1d0f6b-3c2a-4a9e-9c2f-0b7a5d4e8a11")
MIGRATED_FROM = ("_char_ref", "_char_link")
LINK_TYPE = "character.appears_in"
# 契约 §4.7 character.appears_in 要求 target 为 history.event；
# 目标不是 history.event 时降级为通用有向类型 core.references（仍在契约 §4 内）
GENERAL_DIRECTED = "core.references"
APPEARS_IN_TARGET = ("history", "event")


def deterministic_id(*parts: str) -> str:
    return str(uuid.uuid5(NAMESPACE, ":".join(parts)))


def _parse_json(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def upgrade() -> None:
    conn = op.get_bind()
    report: Dict[str, int] = {
        "char_ref_links_created": 0,
        "char_link_links_created": 0,
        "degraded_to_general_type": 0,
        "orphan_char_refs": 0,
        "orphan_char_links": 0,
        "skipped_foreign_char_links": 0,
    }

    character_ids = {
        row._mapping["id"]
        for row in conn.execute(sa.text("SELECT id FROM characters")).fetchall()
    }
    submodules = {
        row._mapping["id"]: row._mapping
        for row in conn.execute(
            sa.text("SELECT id, kind, module_id FROM world_submodules")
        ).fetchall()
    }
    module_worlds = {
        row._mapping["id"]: row._mapping["world_id"]
        for row in conn.execute(
            sa.text("SELECT id, world_id FROM world_modules")
        ).fetchall()
    }
    module_types = {
        row._mapping["id"]: row._mapping["module_type"]
        for row in conn.execute(
            sa.text("SELECT id, module_type FROM world_modules")
        ).fetchall()
    }

    items = conn.execute(
        sa.text(
            "SELECT id, module_id, submodule_id, content FROM world_module_items "
            "WHERE content IS NOT NULL"
        )
    ).fetchall()

    for item in items:
        item = item._mapping
        content = _parse_json(item["content"], None)
        if not isinstance(content, dict):
            continue

        for key in content:
            if key.startswith("_char_ref:"):
                char_id = key[len("_char_ref:") :]
                source_kind = "_char_ref"
                link_id_parts = ("wbl-p1-06", item["id"], key)
            elif key.startswith("_char_link:"):
                suffix = key[len("_char_link:") :]
                colon = suffix.find(":")
                if colon <= 0:
                    report["orphan_char_links"] += 1
                    continue
                linked_item_id, char_id = suffix[:colon], suffix[colon + 1 :]
                if linked_item_id != item["id"]:
                    # 键写在别的 item 上（复制/粘贴的残留），无法归属 -> 计入报告
                    report["skipped_foreign_char_links"] += 1
                    continue
                source_kind = "_char_link"
                link_id_parts = ("wbl-p1-06", item["id"], key)
            else:
                continue

            if not char_id or char_id not in character_ids:
                report[
                    (
                        "orphan_char_refs"
                        if source_kind == "_char_ref"
                        else "orphan_char_links"
                    )
                ] += 1
                continue

            submodule_id = item["submodule_id"]
            submodule = submodules.get(submodule_id) if submodule_id else None
            world_id = module_worlds.get(item["module_id"])
            if submodule is None or not world_id:
                report[
                    (
                        "orphan_char_refs"
                        if source_kind == "_char_ref"
                        else "orphan_char_links"
                    )
                ] += 1
                continue

            link_id = deterministic_id(*link_id_parts)
            if conn.execute(
                sa.text("SELECT 1 FROM world_links WHERE id = :id"), {"id": link_id}
            ).fetchone():
                continue

            target_module = module_types.get(submodule["module_id"], "history")
            target_kind = submodule["kind"] or "event"
            link_type = LINK_TYPE
            link_meta: Dict[str, Any] = {
                "migratedFrom": source_kind,
                "legacyItemId": item["id"],
            }
            if (target_module, target_kind) != APPEARS_IN_TARGET:
                # 目标不是 history.event：character.appears_in 的 kind 约束不成立，
                # 降级为通用有向类型，避免写入契约外的 (link_type, kind) 组合
                link_type = GENERAL_DIRECTED
                link_meta["degradedFrom"] = LINK_TYPE

            conn.execute(
                sa.text(
                    "INSERT INTO world_links "
                    "(id, world_id, source_module, source_kind, source_id, "
                    " target_module, target_kind, target_id, link_type, directed, label, note, "
                    " meta, time, created_at, updated_at) "
                    "VALUES (:id, :world_id, 'character', 'character', :char_id, "
                    " :target_module, :target_kind, :target_id, :link_type, 1, NULL, NULL, "
                    " :meta, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {
                    "id": link_id,
                    "world_id": world_id,
                    "char_id": char_id,
                    "target_module": target_module,
                    "target_kind": target_kind,
                    "target_id": submodule["id"],
                    "link_type": link_type,
                    "meta": json.dumps(link_meta, ensure_ascii=False),
                },
            )
            if link_type != LINK_TYPE:
                report["degraded_to_general_type"] += 1
            if source_kind == "_char_ref":
                report["char_ref_links_created"] += 1
            else:
                report["char_link_links_created"] += 1

    report["world_links_total"] = int(
        conn.execute(
            sa.text(
                "SELECT count(*) FROM world_links "
                "WHERE json_extract(meta, '$.migratedFrom') IN ('_char_ref', '_char_link')"
            )
        ).fetchone()[0]
    )
    logger.info(
        "wbl_p1_06_backfill_char_refs report: %s",
        json.dumps(report, ensure_ascii=False),
    )


def downgrade() -> None:
    """只删除本次回填新增的 world_links；旧 item 不删除。"""

    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM world_links WHERE json_extract(meta, '$.migratedFrom') "
            "IN ('_char_ref', '_char_link')"
        )
    )
