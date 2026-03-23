"""fix_invalid_foreign_key_in_world_templates

Revision ID: b0ec4e485448
Revises: 063d2b67b83b
Create Date: 2026-03-22 14:37:02.959035

此迁移重建 world_templates 表以修复外键约束问题：
1. 移除指向不存在的 users 表的外键 (created_by)
2. 添加指向 projects 表的外键 (project_id)
3. 注意：project_id 列在 1ab95b05f309 迁移中已添加，但无外键约束

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b0ec4e485448'
down_revision: Union[str, None] = '063d2b67b83b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE world_templates_new (
            id VARCHAR(36) NOT NULL, 
            name VARCHAR(255) NOT NULL, 
            description TEXT, 
            cover_image VARCHAR(500), 
            tags JSON, 
            is_public BOOLEAN DEFAULT '0' NOT NULL, 
            is_system_template BOOLEAN DEFAULT '0' NOT NULL, 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
            created_by VARCHAR(36), 
            project_id VARCHAR(36), 
            CONSTRAINT pk_world_templates_new PRIMARY KEY (id), 
            CONSTRAINT fk_world_templates_new_project_id_projects FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL
        )
    """)
    
    op.execute("""
        INSERT INTO world_templates_new 
        SELECT id, name, description, cover_image, tags, is_public, is_system_template, 
               created_at, updated_at, created_by, project_id 
        FROM world_templates
    """)
    
    op.execute("DROP TABLE world_templates")
    
    op.execute("ALTER TABLE world_templates_new RENAME TO world_templates")
    
    op.create_index('ix_world_templates_name', 'world_templates', ['name'], unique=False)
    op.create_index('ix_world_templates_project_id', 'world_templates', ['project_id'], unique=False)


def downgrade() -> None:
    op.execute("""
        CREATE TABLE world_templates_old (
            id VARCHAR(36) NOT NULL, 
            name VARCHAR(255) NOT NULL, 
            description TEXT, 
            cover_image VARCHAR(500), 
            tags JSON, 
            is_public BOOLEAN DEFAULT '0' NOT NULL, 
            is_system_template BOOLEAN DEFAULT '0' NOT NULL, 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
            created_by VARCHAR(36), 
            project_id VARCHAR(36), 
            CONSTRAINT pk_world_templates_old PRIMARY KEY (id), 
            CONSTRAINT fk_world_templates_old_created_by_users FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL, 
            CONSTRAINT fk_world_templates_old_project_id_projects FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL
        )
    """)
    
    op.execute("""
        INSERT INTO world_templates_old 
        SELECT id, name, description, cover_image, tags, is_public, is_system_template, 
               created_at, updated_at, created_by, project_id 
        FROM world_templates
    """)
    
    op.execute("DROP TABLE world_templates")
    
    op.execute("ALTER TABLE world_templates_old RENAME TO world_templates")
    
    op.create_index('ix_world_templates_name', 'world_templates', ['name'], unique=False)
    op.create_index('ix_world_templates_project_id', 'world_templates', ['project_id'], unique=False)
