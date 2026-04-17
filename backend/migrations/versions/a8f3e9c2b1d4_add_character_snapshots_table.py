"""add character snapshots table

Revision ID: a8f3e9c2b1d4
Revises: 7b738d2863c5
Create Date: 2026-04-16 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8f3e9c2b1d4'
down_revision: Union[str, None] = '7b738d2863c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'character_snapshots' in tables:
        return

    op.create_table(
        'character_snapshots',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('character_id', sa.String(36), sa.ForeignKey('characters.id'), nullable=False),
        sa.Column('snapshot_type', sa.String(50), nullable=False),
        sa.Column('volume_id', sa.String(36), nullable=True),
        sa.Column('act_id', sa.String(36), nullable=True),
        sa.Column('chapter_id', sa.String(36), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('attributes', sa.JSON, default=dict),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_index('ix_character_snapshots_character_id_snapshot_type', 'character_snapshots', ['character_id', 'snapshot_type'])
    op.create_index('ix_character_snapshots_created_at', 'character_snapshots', ['created_at'])


def downgrade() -> None:
    op.drop_table('character_snapshots')
