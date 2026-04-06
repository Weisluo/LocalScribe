"""add source column to characters

Revision ID: 7b738d2863c5
Revises: 1c246e47df51
Create Date: 2026-04-04 19:35:00.486950

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b738d2863c5'
down_revision: Union[str, None] = '1c246e47df51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('characters', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'source',
                sa.String(length=50),
                nullable=True,
                comment='来源: history(历史背景), None(主线故事)'
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('characters', schema=None) as batch_op:
        batch_op.drop_column('source')
