"""wbl_p1_05_backfill_links

旧关联回填 world_links（Phase 0 §6.1 P1-MIG-05，契约 §2.5/§4/§8）：
1. bidirectional_relations -> world_links（按项目映射 world_id，多世界/无世界时建迁移容器世界）
2. WorldModuleItem(name="relations") 的 <relationType>:<targetId>:<volume>:<start>:<end> 编码 -> world_links
3. 确定性 UUID 幂等；孤儿（端点不存在、项目缺失）只计数不落库

Revision ID: 2160f6984e8a
Revises: cef4ae3ffe96
Create Date: 2026-10-06 17:59:50.332535

"""

import json
import logging
import uuid
from typing import Any, Dict, Optional, Sequence, Tuple, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2160f6984e8a"
down_revision: Union[str, None] = "cef4ae3ffe96"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

NAMESPACE = uuid.UUID("6f1d0f6b-3c2a-4a9e-9c2f-0b7a5d4e8a11")

# 旧经济关系类型 -> 契约 §4.4（仅当源/目标 kind 也匹配时才使用，否则降级通用类型）
ECONOMY_RELATION_MAP = {
    "supplier": "economy.supplies",
    "consumer": "economy.consumes",
    "dependency": "economy.requires",
    "trade_partner": "economy.flows_to",
}

# 旧通用关系类型 -> 契约 §4 具体类型（同样必须先通过 kind 校验，否则降级通用类型）
LEGACY_RELATION_MAP = {
    "causal": "history.causes",
    "dependency": "economy.requires",
    "hierarchical": "politics.subordinate_to",
}

# 语义对称的旧关系类型：降级时用 core.related_to，其余用 core.references
SYMMETRIC_LEGACY_TYPES = {"trade_partner", "competitor"}

GENERAL_DIRECTED = "core.references"
GENERAL_SYMMETRIC = "core.related_to"

# 契约 §2.2：每个世界七个模块骨架（与 P1-MIG-04 同口径，迁移内自带避免依赖应用代码）
DEFAULT_MODULE_SPECS = (
    ("map", "地图", "map"),
    ("history", "历史", "scroll-text"),
    ("politics", "政治", "crown"),
    ("economy", "经济", "coins"),
    ("races", "种族", "users"),
    ("systems", "体系", "sparkles"),
    ("special", "特殊", "star"),
)


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


def _kind_of(conn, submodule_id: Optional[str]) -> Optional[str]:
    if not submodule_id:
        return None
    row = conn.execute(
        sa.text("SELECT kind FROM world_submodules WHERE id = :id"),
        {"id": submodule_id},
    ).fetchone()
    if row is None:
        return None
    return row._mapping["kind"] or "custom"


def _validate(link_type: str, source: Tuple[str, str], target: Tuple[str, str]) -> bool:
    from app.services.link_registry import get_link_type

    definition = get_link_type(link_type)
    if definition is None:
        return False

    def matches(spec, module: str, kind: str) -> bool:
        if spec is None:
            return True
        return any(
            ref_module == module and (ref_kind in ("*", kind))
            for ref_module, ref_kind in spec
        )

    return matches(definition.source, source[0], source[1]) and matches(
        definition.target, target[0], target[1]
    )


def _ensure_world_modules(conn, world_id: str) -> int:
    """补齐七个模块：P1-MIG-04 只覆盖当时已存在的世界，容器世界是 MIG-05 新建的。"""

    present = {
        row._mapping["module_type"]
        for row in conn.execute(
            sa.text("SELECT module_type FROM world_modules WHERE world_id = :id"),
            {"id": world_id},
        ).fetchall()
    }
    created = 0
    for order_index, (module_type, name, icon) in enumerate(DEFAULT_MODULE_SPECS):
        if module_type in present:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO world_modules "
                "(id, world_id, module_type, name, description, icon, order_index, "
                " config, is_collapsible, is_required, created_at, updated_at) "
                "VALUES (:id, :world_id, :module_type, :name, NULL, :icon, :order_index, "
                " NULL, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {
                "id": deterministic_id("wbl-p1-05", "module", world_id, module_type),
                "world_id": world_id,
                "module_type": module_type,
                "name": name,
                "icon": icon,
                "order_index": order_index,
            },
        )
        created += 1
    return created


def _resolve_project_world(
    conn, project_id: str, containers: Dict[str, str]
) -> Optional[str]:
    """一个项目只有一个世界时直接复用；否则建立确定性迁移容器世界。"""

    exists = conn.execute(
        sa.text("SELECT 1 FROM projects WHERE id = :id"), {"id": project_id}
    ).fetchone()
    if exists is None:
        return None

    world_ids = [
        row._mapping["id"]
        for row in conn.execute(
            sa.text("SELECT id FROM worlds WHERE project_id = :pid ORDER BY id"),
            {"pid": project_id},
        ).fetchall()
    ]
    if len(world_ids) == 1:
        return world_ids[0]

    if project_id in containers:
        return containers[project_id]

    container_id = deterministic_id("wbl-p1-05", "container", project_id)
    if not conn.execute(
        sa.text("SELECT 1 FROM worlds WHERE id = :id"), {"id": container_id}
    ).fetchone():
        conn.execute(
            sa.text(
                "INSERT INTO worlds "
                "(id, name, description, cover_image, tone, settings, project_id, "
                " created_at, updated_at) "
                "VALUES (:id, :name, :description, NULL, NULL, :settings, :project_id, "
                " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {
                "id": container_id,
                "name": "关联迁移容器",
                "description": "旧关联无法归属到具体世界时使用的迁移容器（Phase 1 P1-MIG-05）",
                "settings": json.dumps(
                    {"migrationContainer": True, "projectId": project_id},
                    ensure_ascii=False,
                ),
                "project_id": project_id,
            },
        )
    # 容器世界同样要满足契约 §2.2 的七模块不变式（重复执行不会重复插入）
    containers[project_id] = container_id
    _ensure_world_modules(conn, container_id)
    return container_id


def _insert_link(
    conn,
    *,
    link_id: str,
    world_id: str,
    source: Tuple[str, str, str],
    target: Tuple[str, str, str],
    link_type: str,
    directed: bool,
    meta: Dict[str, Any],
    time_range: Optional[Dict[str, Any]] = None,
    label: Optional[str] = None,
) -> bool:
    if conn.execute(
        sa.text("SELECT 1 FROM world_links WHERE id = :id"), {"id": link_id}
    ).fetchone():
        return False
    conn.execute(
        sa.text(
            "INSERT INTO world_links "
            "(id, world_id, source_module, source_kind, source_id, "
            " target_module, target_kind, target_id, link_type, directed, label, note, "
            " meta, time, created_at, updated_at) "
            "VALUES (:id, :world_id, :source_module, :source_kind, :source_id, "
            " :target_module, :target_kind, :target_id, :link_type, :directed, :label, NULL, "
            " :meta, :time, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ),
        {
            "id": link_id,
            "world_id": world_id,
            "source_module": source[0],
            "source_kind": source[1],
            "source_id": source[2],
            "target_module": target[0],
            "target_kind": target[1],
            "target_id": target[2],
            "link_type": link_type,
            "directed": 1 if directed else 0,
            "label": label,
            "meta": json.dumps(meta, ensure_ascii=False),
            "time": json.dumps(time_range, ensure_ascii=False) if time_range else None,
        },
    )
    return True


def _backfill_bidirectional_relations(conn, report: Dict[str, int]) -> None:
    containers: Dict[str, str] = {}
    known_entities = {
        row._mapping["id"]
        for row in conn.execute(sa.text("SELECT id FROM world_submodules")).fetchall()
    } | {
        row._mapping["id"]
        for row in conn.execute(sa.text("SELECT id FROM world_module_items")).fetchall()
    }

    rows = conn.execute(
        sa.text(
            "SELECT id, source_module, source_entity_type, source_entity_id, source_entity_name, "
            " target_module, target_entity_type, target_entity_id, target_entity_name, "
            " relation_type, bidirectional, strength, metadata_json, project_id "
            "FROM bidirectional_relations ORDER BY created_at, id"
        )
    ).fetchall()

    for row in rows:
        row = row._mapping
        if (
            row["source_entity_id"] not in known_entities
            or row["target_entity_id"] not in known_entities
        ):
            report["orphan_relations"] += 1
            continue

        world_id = _resolve_project_world(conn, row["project_id"], containers)
        if world_id is None:
            report["orphan_relations"] += 1
            continue

        bidirectional = bool(row["bidirectional"])
        source_ref = (row["source_module"], row["source_entity_type"])
        target_ref = (row["target_module"], row["target_entity_type"])
        candidate = LEGACY_RELATION_MAP.get(row["relation_type"])
        if bidirectional:
            link_type = GENERAL_SYMMETRIC
        elif candidate and _validate(candidate, source_ref, target_ref):
            link_type = candidate
            report["relations_mapped_to_contract_types"] += 1
        else:
            link_type = GENERAL_DIRECTED

        meta: Dict[str, Any] = {}
        # 旧 metadata_json 先合并，记账键最后覆盖（保证 legacyRelationType / strength /
        # 端点名 / projectId 不被旧数据改写）
        extra = _parse_json(row["metadata_json"], None)
        if isinstance(extra, dict):
            meta.update(extra)
        meta.update(
            {
                "migratedFrom": "bidirectional_relations",
                "legacyRelationId": row["id"],
                "legacyRelationType": row["relation_type"],
                "strength": row["strength"],
                "legacySourceName": row["source_entity_name"],
                "legacyTargetName": row["target_entity_name"],
                "projectId": row["project_id"],
            }
        )

        created = _insert_link(
            conn,
            link_id=deterministic_id("wbl-p1-05", "rel", row["id"]),
            world_id=world_id,
            source=(
                row["source_module"],
                row["source_entity_type"],
                row["source_entity_id"],
            ),
            target=(
                row["target_module"],
                row["target_entity_type"],
                row["target_entity_id"],
            ),
            link_type=link_type,
            directed=not bidirectional,
            meta=meta,
        )
        if created:
            report["relations_migrated"] += 1


def _backfill_economy_relation_items(conn, report: Dict[str, int]) -> None:
    rows = conn.execute(
        sa.text(
            "SELECT i.id AS item_id, i.submodule_id AS source_id, i.content AS content, "
            "       m.world_id AS world_id, m.module_type AS module_type "
            "FROM world_module_items i JOIN world_modules m ON i.module_id = m.id "
            "WHERE i.name = 'relations'"
        )
    ).fetchall()

    for row in rows:
        row = row._mapping
        content = _parse_json(row["content"], None)
        if not isinstance(content, dict):
            report["orphan_economy_relations"] += 1
            continue
        if not row["source_id"]:
            report["orphan_economy_relations"] += len(content)
            continue

        source_kind = _kind_of(conn, row["source_id"])
        if source_kind is None:
            report["orphan_economy_relations"] += len(content)
            continue

        for key, value in content.items():
            parts = str(value).split(":")
            if len(parts) < 2 or not parts[1]:
                report["orphan_economy_relations"] += 1
                continue
            target_id = parts[1]
            target_kind = _kind_of(conn, target_id)
            if target_kind is None:
                report["orphan_economy_relations"] += 1
                continue

            legacy_type = parts[0]
            candidate = ECONOMY_RELATION_MAP.get(legacy_type)
            source_ref = (row["module_type"], source_kind)
            target_ref = (row["module_type"], target_kind)
            link_type = ""
            directed = True
            if candidate and _validate(candidate, source_ref, target_ref):
                link_type = candidate
            elif legacy_type in SYMMETRIC_LEGACY_TYPES:
                link_type = GENERAL_SYMMETRIC
                directed = False
            else:
                link_type = GENERAL_DIRECTED

            meta = {
                "migratedFrom": "economy_relations",
                "legacyItemId": row["item_id"],
                "legacyKey": key,
                "legacyRelationType": legacy_type,
            }
            if len(parts) >= 3 and parts[2]:
                meta["volume"] = parts[2]
            time_range = None
            if len(parts) >= 5 and (parts[3] or parts[4]):
                time_range = {"start": parts[3] or None, "end": parts[4] or None}

            created = _insert_link(
                conn,
                link_id=deterministic_id("wbl-p1-05", "econ", row["item_id"], str(key)),
                world_id=row["world_id"],
                source=(row["module_type"], source_kind, row["source_id"]),
                target=(row["module_type"], target_kind, target_id),
                link_type=link_type,
                directed=directed,
                meta=meta,
                time_range=time_range,
            )
            if created:
                report["economy_relations_migrated"] += 1


def upgrade() -> None:
    conn = op.get_bind()
    report: Dict[str, int] = {
        "relations_migrated": 0,
        "relations_mapped_to_contract_types": 0,
        "economy_relations_migrated": 0,
        "orphan_relations": 0,
        "orphan_economy_relations": 0,
    }

    _backfill_bidirectional_relations(conn, report)
    _backfill_economy_relation_items(conn, report)

    report["world_links_total"] = int(
        conn.execute(
            sa.text(
                "SELECT count(*) FROM world_links "
                "WHERE json_extract(meta, '$.migratedFrom') "
                "IN ('bidirectional_relations', 'economy_relations')"
            )
        ).fetchone()[0]
    )

    logger.info(
        "wbl_p1_05_backfill_links report: %s", json.dumps(report, ensure_ascii=False)
    )


def downgrade() -> None:
    """只删除本次回填新增的 world_links 与迁移容器世界；旧表与旧 item 不动。"""

    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM world_links WHERE json_extract(meta, '$.migratedFrom') "
            "IN ('bidirectional_relations', 'economy_relations')"
        )
    )
    conn.execute(
        sa.text(
            "DELETE FROM worlds WHERE json_extract(settings, '$.migrationContainer') = 1"
        )
    )
