"""add bidirectional relations table

Revision ID: 25676bc12c35
Revises: 52d22dce2a59
Create Date: 2026-03-24 16:32:14.571580

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '25676bc12c35'
down_revision: Union[str, None] = '52d22dce2a59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建双向关联关系表"""
    # 检查表是否已存在
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'bidirectional_relations' in inspector.get_table_names():
        return

    # 创建双向关联关系表
    op.create_table(
        'bidirectional_relations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('source_module', sa.String(length=50), nullable=False),
        sa.Column('source_entity_type', sa.String(length=100), nullable=False),
        sa.Column('source_entity_id', sa.String(length=36), nullable=False),
        sa.Column('source_entity_name', sa.String(length=255), nullable=False),
        sa.Column('target_module', sa.String(length=50), nullable=False),
        sa.Column('target_entity_type', sa.String(length=100), nullable=False),
        sa.Column('target_entity_id', sa.String(length=36), nullable=False),
        sa.Column('target_entity_name', sa.String(length=255), nullable=False),
        sa.Column('relation_type', sa.String(length=50), nullable=False),
        sa.Column('bidirectional', sa.Boolean(), nullable=False, default=True),
        sa.Column('strength', sa.String(length=20), nullable=False, default='medium'),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ['project_id'],
            ['projects.id'],
            name=op.f('fk_bidirectional_relations_project_id_projects'),
            ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_bidirectional_relations'))
    )

    # 创建索引
    op.create_index(
        op.f('ix_bidirectional_relations_project_id'),
        'bidirectional_relations',
        ['project_id'],
        unique=False
    )
    op.create_index(
        op.f('ix_bidirectional_relations_relation_type'),
        'bidirectional_relations',
        ['relation_type'],
        unique=False
    )
    op.create_index(
        op.f('ix_bidirectional_relations_source_entity_id'),
        'bidirectional_relations',
        ['source_entity_id'],
        unique=False
    )
    op.create_index(
        op.f('ix_bidirectional_relations_source_module'),
        'bidirectional_relations',
        ['source_module'],
        unique=False
    )
    op.create_index(
        op.f('ix_bidirectional_relations_target_entity_id'),
        'bidirectional_relations',
        ['target_entity_id'],
        unique=False
    )
    op.create_index(
        op.f('ix_bidirectional_relations_target_module'),
        'bidirectional_relations',
        ['target_module'],
        unique=False
    )


def downgrade() -> None:
    """删除双向关联关系表"""
    # 检查表是否存在
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'bidirectional_relations' not in inspector.get_table_names():
        return

    # 删除索引
    op.drop_index(
        op.f('ix_bidirectional_relations_target_module'),
        table_name='bidirectional_relations'
    )
    op.drop_index(
        op.f('ix_bidirectional_relations_target_entity_id'),
        table_name='bidirectional_relations'
    )
    op.drop_index(
        op.f('ix_bidirectional_relations_source_module'),
        table_name='bidirectional_relations'
    )
    op.drop_index(
        op.f('ix_bidirectional_relations_source_entity_id'),
        table_name='bidirectional_relations'
    )
    op.drop_index(
        op.f('ix_bidirectional_relations_relation_type'),
        table_name='bidirectional_relations'
    )
    op.drop_index(
        op.f('ix_bidirectional_relations_project_id'),
        table_name='bidirectional_relations'
    )

    # 删除表
    op.drop_table('bidirectional_relations')
