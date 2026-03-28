"""add_scene_count_and_outline_characters_to_notes

Revision ID: e4d193aee4eb
Revises: b1b7ce64ee69
Create Date: 2026-03-28 00:17:12.575999

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e4d193aee4eb'
down_revision: Union[str, None] = 'b1b7ce64ee69'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    columns = [col['name'] for col in inspector.get_columns('notes')]
    
    with op.batch_alter_table('notes', schema=None) as batch_op:
        if 'scene_count' not in columns:
            batch_op.add_column(sa.Column('scene_count', sa.Integer(), nullable=True, comment='场景数估计'))
        if 'outline_characters' not in columns:
            batch_op.add_column(sa.Column('outline_characters', sa.JSON(), nullable=True, comment='出场角色ID列表'))


def downgrade() -> None:
    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.drop_column('outline_characters')
        batch_op.drop_column('scene_count')
