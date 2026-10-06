"""wbl_p1_03_world_links

建立 world_links 表与三类索引（契约 §2.5，Phase 0 §6.1 P1-MIG-03）。
带存在性检查，可重复执行。

Revision ID: d5a573ce6f22
Revises: fa05a62b0da8
Create Date: 2026-10-06 17:59:49.574089

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5a573ce6f22"
down_revision: Union[str, None] = "fa05a62b0da8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _index_names(table: str) -> set:
    return {i["name"] for i in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    if "world_links" not in _table_names():
        op.create_table(
            "world_links",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("world_id", sa.String(36), nullable=False),
            sa.Column("source_module", sa.String(50), nullable=False),
            sa.Column("source_kind", sa.String(100), nullable=False),
            sa.Column("source_id", sa.String(36), nullable=False),
            sa.Column("target_module", sa.String(50), nullable=False),
            sa.Column("target_kind", sa.String(100), nullable=False),
            sa.Column("target_id", sa.String(36), nullable=False),
            sa.Column("link_type", sa.String(50), nullable=False),
            sa.Column("directed", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("label", sa.String(255), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("meta", sa.JSON(), nullable=True),
            sa.Column("time", sa.JSON(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.ForeignKeyConstraint(
                ["world_id"], ["worlds.id"], name="fk_world_links_world_id_worlds"
            ),
            sa.PrimaryKeyConstraint("id", name="pk_world_links"),
        )

    indexes = _index_names("world_links")
    if "ix_world_links_world_source" not in indexes:
        op.create_index(
            "ix_world_links_world_source",
            "world_links",
            ["world_id", "source_module", "source_id"],
        )
    if "ix_world_links_world_target" not in indexes:
        op.create_index(
            "ix_world_links_world_target",
            "world_links",
            ["world_id", "target_module", "target_id"],
        )
    if "ix_world_links_world_type" not in indexes:
        op.create_index(
            "ix_world_links_world_type", "world_links", ["world_id", "link_type"]
        )


def downgrade() -> None:
    if "world_links" in _table_names():
        op.drop_table("world_links")
