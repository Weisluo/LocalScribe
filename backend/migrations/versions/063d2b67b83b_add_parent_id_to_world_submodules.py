"""add parent_id to world_submodules

Revision ID: 063d2b67b83b
Revises: 1ab95b05f309
Create Date: 2026-03-22 14:19:48.105620

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '063d2b67b83b'
down_revision: Union[str, None] = '1ab95b05f309'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE world_submodules ADD COLUMN parent_id VARCHAR(36)')


def downgrade() -> None:
    op.execute('ALTER TABLE world_submodules DROP COLUMN parent_id')
