"""add performance indexes

Revision ID: b82273cf3783
Revises: a72273cf3782
Create Date: 2026-03-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b82273cf3783'
down_revision: Union[str, None] = 'a72273cf3782'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_notes_status', 'notes', ['status'], unique=False)
    op.create_index('ix_notes_deleted_at', 'notes', ['deleted_at'], unique=False)
    op.create_index('ix_notes_order', 'notes', ['order'], unique=False)
    op.create_index('ix_folders_type', 'folders', ['type'], unique=False)
    op.create_index('ix_folders_order', 'folders', ['order'], unique=False)
    op.create_index('ix_notes_folder_order', 'notes', ['folder_id', 'order'], unique=False)
    op.create_index('ix_notes_project_deleted', 'notes', ['project_id', 'deleted_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_notes_project_deleted', table_name='notes')
    op.drop_index('ix_notes_folder_order', table_name='notes')
    op.drop_index('ix_folders_order', table_name='folders')
    op.drop_index('ix_folders_type', table_name='folders')
    op.drop_index('ix_notes_order', table_name='notes')
    op.drop_index('ix_notes_deleted_at', table_name='notes')
    op.drop_index('ix_notes_status', table_name='notes')
