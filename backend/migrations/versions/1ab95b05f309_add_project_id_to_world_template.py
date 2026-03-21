"""add_project_id_to_world_template

Revision ID: 1ab95b05f309
Revises: c92273cf3784
Create Date: 2026-03-21 13:25:42.639288

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1ab95b05f309'
down_revision: Union[str, None] = 'c92273cf3784'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('world_templates', sa.Column('project_id', sa.String(36), nullable=True))
    op.create_foreign_key('fk_world_templates_project_id_projects', 'world_templates', 'projects', ['project_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_world_templates_project_id'), 'world_templates', ['project_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_world_templates_project_id'), table_name='world_templates')
    op.drop_constraint('fk_world_templates_project_id_projects', 'world_templates', type_='foreignkey')
    op.drop_column('world_templates', 'project_id')
