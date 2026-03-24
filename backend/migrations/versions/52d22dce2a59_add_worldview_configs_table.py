"""add worldview_configs table

Revision ID: 52d22dce2a59
Revises: b0ec4e485448
Create Date: 2026-03-24 10:24:45.752168

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '52d22dce2a59'
down_revision: Union[str, None] = 'b0ec4e485448'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    tables = inspector.get_table_names()

    if 'worldview_configs' not in tables:
        op.create_table(
            'worldview_configs',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('type', sa.String(length=50), nullable=False),
            sa.Column('time_scale', sa.String(length=50), nullable=False),
            sa.Column('tech_level', sa.String(length=50), nullable=False),
            sa.Column('magic_level', sa.String(length=50), nullable=False),
            sa.Column('political_complexity', sa.String(length=50), nullable=False),
            sa.Column('economic_system', sa.String(length=50), nullable=False),
            sa.Column('module_configs', sa.JSON(), nullable=True),
            sa.Column('theme', sa.JSON(), nullable=True),
            sa.Column('relation_rules', sa.JSON(), nullable=True),
            sa.Column('presets', sa.JSON(), nullable=True),
            sa.Column('is_system', sa.Boolean(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.text('(CURRENT_TIMESTAMP)'),
                nullable=True,
            ),
            sa.Column(
                'updated_at',
                sa.DateTime(timezone=True),
                server_default=sa.text('(CURRENT_TIMESTAMP)'),
                nullable=True,
            ),
            sa.Column('created_by', sa.String(length=36), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_worldview_configs_id', 'worldview_configs', ['id'], unique=False)
        op.create_index('ix_worldview_configs_name', 'worldview_configs', ['name'], unique=True)
        op.create_index('ix_worldview_configs_type', 'worldview_configs', ['type'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'worldview_configs' in tables:
        op.drop_index('ix_worldview_configs_type', table_name='worldview_configs')
        op.drop_index('ix_worldview_configs_name', table_name='worldview_configs')
        op.drop_index('ix_worldview_configs_id', table_name='worldview_configs')
        op.drop_table('worldview_configs')
