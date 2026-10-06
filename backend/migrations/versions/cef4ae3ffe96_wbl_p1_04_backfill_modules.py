"""wbl_p1_04_backfill_modules

旧编码回填（Phase 0 §6.1 P1-MIG-04，契约 §2.2/§2.3）：
1. WorldModuleItem(name="moduleConfig") -> WorldModule.config
2. WorldSubmodule.color 前缀（era:/type:）与 icon 的 era:start:end -> kind/meta
3. 每个世界补齐七个模块（确定性 UUID，可重复执行）

不删除旧 item、不改 color 原值（双读窗口，Phase 2 才切 UI）。

Revision ID: cef4ae3ffe96
Revises: d5a573ce6f22
Create Date: 2026-10-06 17:59:49.962926

"""

import json
import logging
import uuid
from typing import Any, Dict, Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cef4ae3ffe96"
down_revision: Union[str, None] = "d5a573ce6f22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

# 确定性命名空间：同一输入永远得到同一 UUID，保证迁移可重复执行
NAMESPACE = uuid.UUID("6f1d0f6b-3c2a-4a9e-9c2f-0b7a5d4e8a11")

# 七个固定模块的默认骨架（不预设世界观内容）
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


def derive_kind(color: Any, module_type: Any = None) -> str:
    """旧 color 前缀 -> kind（与 app.models.worldbuilding.derive_submodule_kind 同口径）。

    history 模块：era:* -> era，其余（事件默认色值）-> event；其他模块按前缀推导。
    """

    if module_type == "history":
        if color and str(color).startswith("era:"):
            return "era"
        return "event"
    if not color:
        return "custom"
    if color.startswith("era:"):
        return "era"
    if color.startswith("type:"):
        parts = color.split(":")
        return parts[1] or "custom"
    return "custom"


def derive_meta(color: Any, icon: Any, existing: Any) -> Dict[str, Any]:
    meta: Dict[str, Any] = dict(existing or {})
    if color:
        meta.setdefault("legacyColor", color)
        if color.startswith("era:"):
            meta.setdefault("theme", color.split(":", 1)[1])
        elif color.startswith("type:"):
            parts = color.split(":")
            if len(parts) >= 3:
                meta.setdefault("level", parts[2])
    if icon and icon.startswith("era:"):
        parts = icon.split(":")
        if len(parts) >= 3:
            meta.setdefault("time", {"start": parts[1], "end": parts[2]})
    return meta


def upgrade() -> None:
    conn = op.get_bind()
    report: Dict[str, Any] = {
        "module_config_filled": 0,
        "kind_filled": 0,
        "meta_filled": 0,
        "modules_created": 0,
        "unknown_color_prefix": 0,
        "duplicate_module_types": 0,
    }

    # 1) moduleConfig 条目 -> WorldModule.config（保留旧条目，双读）
    module_configs: Dict[str, Any] = {}
    for row in conn.execute(
        sa.text("SELECT module_id, content FROM world_module_items WHERE name = :name"),
        {"name": "moduleConfig"},
    ).fetchall():
        content = _parse_json(row._mapping["content"], None)
        if isinstance(content, dict):
            module_configs.setdefault(row._mapping["module_id"], content)

    current_configs = {
        row._mapping["id"]: row._mapping["config"]
        for row in conn.execute(
            sa.text("SELECT id, config FROM world_modules")
        ).fetchall()
    }
    for module_id, content in module_configs.items():
        if module_id in current_configs and not current_configs[module_id]:
            conn.execute(
                sa.text("UPDATE world_modules SET config = :config WHERE id = :id"),
                {"config": json.dumps(content, ensure_ascii=False), "id": module_id},
            )
            report["module_config_filled"] += 1

    # 2) 子模块 color/icon 旧编码 -> kind/meta
    submodule_rows = conn.execute(
        sa.text(
            "SELECT s.id AS id, s.color AS color, s.icon AS icon, s.kind AS kind, "
            "       s.meta AS meta, m.module_type AS module_type "
            "FROM world_submodules s LEFT JOIN world_modules m ON s.module_id = m.id"
        )
    ).fetchall()
    for row in submodule_rows:
        row = row._mapping
        if not row["kind"]:
            conn.execute(
                sa.text("UPDATE world_submodules SET kind = :kind WHERE id = :id"),
                {
                    "kind": derive_kind(row["color"], row["module_type"]),
                    "id": row["id"],
                },
            )
            report["kind_filled"] += 1

        existing_meta = _parse_json(row["meta"], {})
        if not isinstance(existing_meta, dict):
            existing_meta = {}
        meta = derive_meta(row["color"], row["icon"], existing_meta)
        if meta != existing_meta:
            conn.execute(
                sa.text("UPDATE world_submodules SET meta = :meta WHERE id = :id"),
                {"meta": json.dumps(meta, ensure_ascii=False), "id": row["id"]},
            )
            report["meta_filled"] += 1

        color = row["color"]
        if (
            color
            and row["module_type"] != "history"
            and not (
                color.startswith("era:")
                or color.startswith("type:")
                or color.startswith("#")
            )
        ):
            report["unknown_color_prefix"] += 1

    # 3) 每个世界补齐七个模块
    existing_modules: Dict[str, set] = {}
    for row in conn.execute(
        sa.text(
            "SELECT world_id, module_type, count(*) AS n FROM world_modules GROUP BY world_id, module_type"
        )
    ).fetchall():
        row = row._mapping
        existing_modules.setdefault(row["world_id"], set()).add(row["module_type"])
        if row["n"] > 1:
            report["duplicate_module_types"] += 1

    world_ids = [
        row._mapping["id"]
        for row in conn.execute(sa.text("SELECT id FROM worlds")).fetchall()
    ]
    for world_id in world_ids:
        present = existing_modules.get(world_id, set())
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
                    "id": deterministic_id("wbl-p1-04", world_id, module_type),
                    "world_id": world_id,
                    "module_type": module_type,
                    "name": name,
                    "icon": icon,
                    "order_index": order_index,
                },
            )
            report["modules_created"] += 1

    logger.info(
        "wbl_p1_04_backfill_modules report: %s", json.dumps(report, ensure_ascii=False)
    )


def downgrade() -> None:
    """D3 回滚：只清 kind/meta/config 与本次补齐的空模块，color 与旧 item 原值保留。"""

    conn = op.get_bind()
    conn.execute(sa.text("UPDATE world_submodules SET kind = NULL, meta = NULL"))
    conn.execute(sa.text("UPDATE world_modules SET config = NULL"))

    world_ids = [
        row._mapping["id"]
        for row in conn.execute(sa.text("SELECT id FROM worlds")).fetchall()
    ]
    for world_id in world_ids:
        for module_type, _name, _icon in DEFAULT_MODULE_SPECS:
            conn.execute(
                sa.text("DELETE FROM world_modules WHERE id = :id"),
                {"id": deterministic_id("wbl-p1-04", world_id, module_type)},
            )
