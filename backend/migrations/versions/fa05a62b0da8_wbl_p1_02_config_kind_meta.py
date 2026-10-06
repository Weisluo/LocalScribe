"""wbl_p1_02_config_kind_meta

新增 world_modules.config、world_submodules.kind/meta 与 kind 索引；
全部带存在性检查，可重复执行（Phase 0 §6.1 P1-MIG-02）。

Revision ID: fa05a62b0da8
Revises: 570767e6d582
Create Date: 2026-10-06 17:59:49.212180

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fa05a62b0da8"
down_revision: Union[str, None] = "570767e6d582"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _index_names(table: str) -> set:
    return {i["name"] for i in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    module_columns = _column_names("world_modules")
    if "config" not in module_columns:
        with op.batch_alter_table("world_modules") as batch_op:
            batch_op.add_column(sa.Column("config", sa.JSON(), nullable=True))

    submodule_columns = _column_names("world_submodules")
    with op.batch_alter_table("world_submodules") as batch_op:
        if "kind" not in submodule_columns:
            batch_op.add_column(sa.Column("kind", sa.String(50), nullable=True))
        if "meta" not in submodule_columns:
            batch_op.add_column(sa.Column("meta", sa.JSON(), nullable=True))

    if "ix_world_submodules_kind" not in _index_names("world_submodules"):
        op.create_index("ix_world_submodules_kind", "world_submodules", ["kind"])


def downgrade() -> None:
    if "ix_world_submodules_kind" in _index_names("world_submodules"):
        op.drop_index("ix_world_submodules_kind", table_name="world_submodules")

    submodule_columns = _column_names("world_submodules")
    with op.batch_alter_table("world_submodules") as batch_op:
        if "meta" in submodule_columns:
            batch_op.drop_column("meta")
        if "kind" in submodule_columns:
            batch_op.drop_column("kind")

    module_columns = _column_names("world_modules")
    if "config" in module_columns:
        with op.batch_alter_table("world_modules") as batch_op:
            batch_op.drop_column("config")
