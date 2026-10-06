"""wbl_p1_01_worlds_rename

world_templates 改名 worlds，新增 tone/settings；旧列（tags/is_public/is_system_template/
created_by）先降级进 settings.legacyTemplate 再删除；world_modules.template_id 改名 world_id
并更换索引。全部操作带存在性检查，可重复执行（Phase 0 §6.1 P1-MIG-01）。

Revision ID: 570767e6d582
Revises: a8f3e9c2b1d4
Create Date: 2026-10-06 17:59:48.839583

"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "570767e6d582"
down_revision: Union[str, None] = "a8f3e9c2b1d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LEGACY_TEMPLATE_KEY = "legacyTemplate"
LEGACY_COLUMNS = ("tags", "is_public", "is_system_template", "created_by")


def _table_names() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _column_names(table: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _index_names(table: str) -> set:
    return {i["name"] for i in sa.inspect(op.get_bind()).get_indexes(table)}


def _parse_json(value, default):
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _move_legacy_columns_into_settings() -> int:
    """把旧模板列写进 settings.legacyTemplate，返回处理行数。"""

    conn = op.get_bind()
    columns = _column_names("worlds")
    available = [c for c in LEGACY_COLUMNS if c in columns]
    if not available:
        return 0

    select_cols = ", ".join(["id", "settings"] + available)
    rows = conn.execute(sa.text(f"SELECT {select_cols} FROM worlds")).fetchall()
    moved = 0
    for row in rows:
        row = row._mapping
        bucket = dict(_parse_json(row["settings"], {}) or {})
        legacy = dict(bucket.get(LEGACY_TEMPLATE_KEY) or {})
        changed = False
        for col in available:
            value = row[col]
            if col in ("is_public", "is_system_template"):
                value = bool(value)
            elif col == "tags":
                value = _parse_json(value, None)
            if value is None or value is False or value == []:
                continue
            legacy[col] = value
            changed = True
        if not changed and not legacy:
            continue
        bucket[LEGACY_TEMPLATE_KEY] = legacy
        conn.execute(
            sa.text("UPDATE worlds SET settings = :settings WHERE id = :id"),
            {"settings": json.dumps(bucket, ensure_ascii=False), "id": row["id"]},
        )
        moved += 1
    return moved


def _restore_legacy_columns() -> None:
    """downgrade：把 settings.legacyTemplate 写回旧列。"""

    conn = op.get_bind()
    columns = _column_names("worlds")
    if "settings" not in columns:
        return
    rows = conn.execute(sa.text("SELECT id, settings FROM worlds")).fetchall()
    for row in rows:
        row = row._mapping
        legacy = (_parse_json(row["settings"], {}) or {}).get(LEGACY_TEMPLATE_KEY) or {}
        assignments = []
        params = {"id": row["id"]}
        for col in LEGACY_COLUMNS:
            if col not in columns:
                continue
            value = legacy.get(col)
            if col == "tags":
                params[col] = json.dumps(
                    value if value is not None else None, ensure_ascii=False
                )
            elif col in ("is_public", "is_system_template"):
                params[col] = 1 if value else 0
            else:
                params[col] = value
            assignments.append(f"{col} = :{col}")
        if assignments:
            conn.execute(
                sa.text(f"UPDATE worlds SET {', '.join(assignments)} WHERE id = :id"),
                params,
            )


def upgrade() -> None:
    conn = op.get_bind()
    tables = _table_names()

    if "world_templates" in tables:
        op.rename_table("world_templates", "worlds")

    # 索引改名（SQLite 不支持 ALTER INDEX RENAME，删旧建新）
    indexes = _index_names("worlds")
    if "ix_world_templates_project_id" in indexes:
        op.drop_index("ix_world_templates_project_id", table_name="worlds")
    if "ix_world_templates_name" in indexes:
        op.drop_index("ix_world_templates_name", table_name="worlds")
    indexes = _index_names("worlds")
    if "ix_worlds_project_id" not in indexes:
        op.create_index("ix_worlds_project_id", "worlds", ["project_id"])
    if "ix_worlds_name" not in indexes:
        op.create_index("ix_worlds_name", "worlds", ["name"])

    # 新增 tone / settings
    columns = _column_names("worlds")
    with op.batch_alter_table("worlds") as batch_op:
        if "tone" not in columns:
            batch_op.add_column(sa.Column("tone", sa.JSON(), nullable=True))
        if "settings" not in columns:
            batch_op.add_column(sa.Column("settings", sa.JSON(), nullable=True))

    _move_legacy_columns_into_settings()

    # 删除旧列
    columns = _column_names("worlds")
    with op.batch_alter_table("worlds") as batch_op:
        for col in LEGACY_COLUMNS:
            if col in columns:
                batch_op.drop_column(col)

    # world_modules.template_id -> world_id
    module_columns = _column_names("world_modules")
    if "template_id" in module_columns and "world_id" not in module_columns:
        with op.batch_alter_table("world_modules") as batch_op:
            batch_op.alter_column("template_id", new_column_name="world_id")

    module_indexes = _index_names("world_modules")
    if "ix_world_modules_template_id" in module_indexes:
        op.drop_index("ix_world_modules_template_id", table_name="world_modules")
    if "ix_world_modules_template_type" in module_indexes:
        op.drop_index("ix_world_modules_template_type", table_name="world_modules")
    module_indexes = _index_names("world_modules")
    if "ix_world_modules_world_id" not in module_indexes:
        op.create_index("ix_world_modules_world_id", "world_modules", ["world_id"])
    if "ix_world_modules_world_type" not in module_indexes:
        op.create_index(
            "ix_world_modules_world_type", "world_modules", ["world_id", "module_type"]
        )


def downgrade() -> None:
    # world_modules.world_id -> template_id
    module_columns = _column_names("world_modules")
    if "world_id" in module_columns and "template_id" not in module_columns:
        with op.batch_alter_table("world_modules") as batch_op:
            batch_op.alter_column("world_id", new_column_name="template_id")

    module_indexes = _index_names("world_modules")
    if "ix_world_modules_world_id" in module_indexes:
        op.drop_index("ix_world_modules_world_id", table_name="world_modules")
    if "ix_world_modules_world_type" in module_indexes:
        op.drop_index("ix_world_modules_world_type", table_name="world_modules")
    module_indexes = _index_names("world_modules")
    if "ix_world_modules_template_id" not in module_indexes:
        op.create_index(
            "ix_world_modules_template_id", "world_modules", ["template_id"]
        )
    if "ix_world_modules_template_type" not in module_indexes:
        op.create_index(
            "ix_world_modules_template_type",
            "world_modules",
            ["template_id", "module_type"],
        )

    # 恢复旧列
    columns = _column_names("worlds")
    with op.batch_alter_table("worlds") as batch_op:
        if "tags" not in columns:
            batch_op.add_column(sa.Column("tags", sa.JSON(), nullable=True))
        if "is_public" not in columns:
            batch_op.add_column(
                sa.Column("is_public", sa.Boolean(), nullable=False, server_default="0")
            )
        if "is_system_template" not in columns:
            batch_op.add_column(
                sa.Column(
                    "is_system_template",
                    sa.Boolean(),
                    nullable=False,
                    server_default="0",
                )
            )
        if "created_by" not in columns:
            batch_op.add_column(sa.Column("created_by", sa.String(36), nullable=True))

    _restore_legacy_columns()

    # 删除 tone / settings
    columns = _column_names("worlds")
    with op.batch_alter_table("worlds") as batch_op:
        if "tone" in columns:
            batch_op.drop_column("tone")
        if "settings" in columns:
            batch_op.drop_column("settings")

    # 索引改名回旧名
    indexes = _index_names("worlds")
    if "ix_worlds_project_id" in indexes:
        op.drop_index("ix_worlds_project_id", table_name="worlds")
    if "ix_worlds_name" in indexes:
        op.drop_index("ix_worlds_name", table_name="worlds")
    indexes = _index_names("worlds")
    if "ix_world_templates_project_id" not in indexes:
        op.create_index("ix_world_templates_project_id", "worlds", ["project_id"])
    if "ix_world_templates_name" not in indexes:
        op.create_index("ix_world_templates_name", "worlds", ["name"])

    if "worlds" in _table_names():
        op.rename_table("worlds", "world_templates")
