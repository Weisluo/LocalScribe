"""wbl_p6_01_drop_legacy_tables

Phase 6 P6-T11：删除被替代的系统旧表（phase6 plan §4/§6、契约 §8）。
- world_instances          世界实例概念取消（D5）
- worldview_configs        预置世界观配置取消（D5）
- bidirectional_relations  world_links 成为唯一关系来源（D1）

三张表都没有入向外键（没有其他表引用它们），upgrade 直接 drop，逐表存在性检查保持幂等。
downgrade 只按 c92273cf3784 / 52d22dce2a59 / 25676bc12c35 的形状重建空表，
不回填旧数据（phase6 plan §8：删表不可逆，downgrade 仅重建空表）。

重建的外键必须指向**当前**修订里的表名：SQLite 在 570767e6d582（P1-MIG-01）执行
`ALTER TABLE world_templates RENAME TO worlds` 时已自动把 world_instances.template_id 的引用
改写为 worlds（实测 PRAGMA foreign_key_list 返回 worlds），因此 downgrade 也写 worlds；
若照抄旧迁移的 world_templates，SQLite 建表时不校验父表存在，会静默产出一张写入即
`no such table: main.world_templates` 的坏表。

Revision ID: 74bd4aa85478
Revises: d4e8b1c7a206
Create Date: 2026-10-07 12:58:02.296685

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "74bd4aa85478"
down_revision: Union[str, None] = "d4e8b1c7a206"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 退场顺序与建表顺序无关（互不入外键）
LEGACY_TABLES = ("world_instances", "worldview_configs", "bidirectional_relations")


def _table_names() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    tables = _table_names()
    for table in LEGACY_TABLES:
        if table in tables:
            op.drop_table(table)


def downgrade() -> None:
    tables = _table_names()

    # world_instances（形状同 c92273cf3784_add_worldbuilding_tables.py，空表）
    if "world_instances" not in tables:
        op.create_table(
            "world_instances",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("template_id", sa.String(36), nullable=False),
            sa.Column("project_id", sa.String(36), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("custom_data", sa.JSON(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["template_id"], ["worlds.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        )
        op.create_index(
            op.f("ix_world_instances_template_id"),
            "world_instances",
            ["template_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_world_instances_project_id"),
            "world_instances",
            ["project_id"],
            unique=False,
        )

    # worldview_configs（形状同 52d22dce2a59_add_worldview_configs_table.py，空表）
    if "worldview_configs" not in tables:
        op.create_table(
            "worldview_configs",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("type", sa.String(50), nullable=False),
            sa.Column("time_scale", sa.String(50), nullable=False),
            sa.Column("tech_level", sa.String(50), nullable=False),
            sa.Column("magic_level", sa.String(50), nullable=False),
            sa.Column("political_complexity", sa.String(50), nullable=False),
            sa.Column("economic_system", sa.String(50), nullable=False),
            sa.Column("module_configs", sa.JSON(), nullable=True),
            sa.Column("theme", sa.JSON(), nullable=True),
            sa.Column("relation_rules", sa.JSON(), nullable=True),
            sa.Column("presets", sa.JSON(), nullable=True),
            sa.Column("is_system", sa.Boolean(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=True,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=True,
            ),
            sa.Column("created_by", sa.String(36), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_worldview_configs_id", "worldview_configs", ["id"], unique=False
        )
        op.create_index(
            "ix_worldview_configs_name", "worldview_configs", ["name"], unique=True
        )
        op.create_index(
            "ix_worldview_configs_type", "worldview_configs", ["type"], unique=False
        )

    # bidirectional_relations（形状同 25676bc12c35_add_bidirectional_relations_table.py，空表）
    if "bidirectional_relations" not in tables:
        op.create_table(
            "bidirectional_relations",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("source_module", sa.String(50), nullable=False),
            sa.Column("source_entity_type", sa.String(100), nullable=False),
            sa.Column("source_entity_id", sa.String(36), nullable=False),
            sa.Column("source_entity_name", sa.String(255), nullable=False),
            sa.Column("target_module", sa.String(50), nullable=False),
            sa.Column("target_entity_type", sa.String(100), nullable=False),
            sa.Column("target_entity_id", sa.String(36), nullable=False),
            sa.Column("target_entity_name", sa.String(255), nullable=False),
            sa.Column("relation_type", sa.String(50), nullable=False),
            sa.Column("bidirectional", sa.Boolean(), nullable=False, default=True),
            sa.Column("strength", sa.String(20), nullable=False, default="medium"),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.Column("project_id", sa.String(36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["project_id"],
                ["projects.id"],
                name=op.f("fk_bidirectional_relations_project_id_projects"),
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_bidirectional_relations")),
        )
        op.create_index(
            op.f("ix_bidirectional_relations_project_id"),
            "bidirectional_relations",
            ["project_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_bidirectional_relations_relation_type"),
            "bidirectional_relations",
            ["relation_type"],
            unique=False,
        )
        op.create_index(
            op.f("ix_bidirectional_relations_source_entity_id"),
            "bidirectional_relations",
            ["source_entity_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_bidirectional_relations_source_module"),
            "bidirectional_relations",
            ["source_module"],
            unique=False,
        )
        op.create_index(
            op.f("ix_bidirectional_relations_target_entity_id"),
            "bidirectional_relations",
            ["target_entity_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_bidirectional_relations_target_module"),
            "bidirectional_relations",
            ["target_module"],
            unique=False,
        )
