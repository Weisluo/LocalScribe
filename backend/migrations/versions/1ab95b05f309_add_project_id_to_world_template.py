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
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('world_templates')]
    
    # 如果列已存在，说明已经通过其他方式（如 b0ec4e485448）添加过了，跳过
    if 'project_id' in columns:
        return
    
    # 使用直接 SQL 执行，避免 batch_alter_table 触发表反射
    # 因为 world_templates 表有外键指向不存在的 users 表，反射会失败
    op.execute("ALTER TABLE world_templates ADD COLUMN project_id VARCHAR(36)")
    op.execute("CREATE INDEX ix_world_templates_project_id ON world_templates(project_id)")
    # 注意：SQLite 不支持 ALTER TABLE ADD FOREIGN KEY
    # 外键约束将在 b0ec4e485448 迁移中通过表重建来添加（该迁移会重建 world_templates 表并包含完整的外键约束）


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('world_templates')]

    # 如果列不存在，跳过
    if 'project_id' not in columns:
        return

    # 删除索引
    op.execute("DROP INDEX IF EXISTS ix_world_templates_project_id")

    # SQLite 不支持 ALTER TABLE DROP COLUMN，需要使用表重建
    # 获取现有表结构
    table_sql = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='world_templates'"
    ).scalar()

    if table_sql:
        # 创建新表（不包含 project_id 列）
        # 从原 SQL 中移除 project_id 列定义
        new_table_sql = table_sql.replace('project_id VARCHAR(36),', '')
        new_table_sql = new_table_sql.replace('project_id VARCHAR(36)', '')
        new_table_sql = new_table_sql.replace(', ,', ',')
        new_table_sql = new_table_sql.replace('(, ', '(')
        new_table_sql = new_table_sql.replace(', )', ')')

        # 使用临时表名
        temp_table_sql = new_table_sql.replace('world_templates', 'world_templates_temp')

        # 创建临时表
        op.execute(temp_table_sql)

        # 复制数据（排除 project_id 列）
        other_columns = [col for col in columns if col != 'project_id']
        columns_str = ', '.join(other_columns)
        op.execute(f"INSERT INTO world_templates_temp ({columns_str}) SELECT {columns_str} FROM world_templates")

        # 删除旧表，重命名新表
        op.execute("DROP TABLE world_templates")
        op.execute("ALTER TABLE world_templates_temp RENAME TO world_templates")
