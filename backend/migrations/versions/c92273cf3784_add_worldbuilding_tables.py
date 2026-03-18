"""Add worldbuilding tables

Revision ID: c92273cf3784
Revises: b82273cf3783
Create Date: 2026-03-18 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c92273cf3784'
down_revision: Union[str, None] = 'b82273cf3783'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('world_templates',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_image', sa.String(500), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('is_system_template', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index(op.f('ix_world_templates_name'), 'world_templates', ['name'], unique=False)
    
    op.create_table('world_modules',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('template_id', sa.String(36), nullable=False),
        sa.Column('module_type', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(100), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_collapsible', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['template_id'], ['world_templates.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_world_modules_template_id'), 'world_modules', ['template_id'], unique=False)
    op.create_index(op.f('ix_world_modules_module_type'), 'world_modules', ['module_type'], unique=False)
    op.create_index('ix_world_modules_template_type', 'world_modules', ['template_id', 'module_type'], unique=False)
    
    op.create_table('world_submodules',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('module_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('icon', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['module_id'], ['world_modules.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_world_submodules_module_id'), 'world_submodules', ['module_id'], unique=False)
    
    op.create_table('world_module_items',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('module_id', sa.String(36), nullable=False),
        sa.Column('submodule_id', sa.String(36), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['module_id'], ['world_modules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submodule_id'], ['world_submodules.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_world_module_items_module_id'), 'world_module_items', ['module_id'], unique=False)
    op.create_index(op.f('ix_world_module_items_submodule_id'), 'world_module_items', ['submodule_id'], unique=False)
    op.create_index('ix_world_module_items_module_submodule', 'world_module_items', ['module_id', 'submodule_id'], unique=False)
    
    op.create_table('world_instances',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('template_id', sa.String(36), nullable=False),
        sa.Column('project_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('custom_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['template_id'], ['world_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_world_instances_template_id'), 'world_instances', ['template_id'], unique=False)
    op.create_index(op.f('ix_world_instances_project_id'), 'world_instances', ['project_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_world_instances_project_id'), table_name='world_instances')
    op.drop_index(op.f('ix_world_instances_template_id'), table_name='world_instances')
    op.drop_table('world_instances')
    
    op.drop_index('ix_world_module_items_module_submodule', table_name='world_module_items')
    op.drop_index(op.f('ix_world_module_items_submodule_id'), table_name='world_module_items')
    op.drop_index(op.f('ix_world_module_items_module_id'), table_name='world_module_items')
    op.drop_table('world_module_items')
    
    op.drop_index(op.f('ix_world_submodules_module_id'), table_name='world_submodules')
    op.drop_table('world_submodules')
    
    op.drop_index('ix_world_modules_template_type', table_name='world_modules')
    op.drop_index(op.f('ix_world_modules_module_type'), table_name='world_modules')
    op.drop_index(op.f('ix_world_modules_template_id'), table_name='world_modules')
    op.drop_table('world_modules')
    
    op.drop_index(op.f('ix_world_templates_name'), table_name='world_templates')
    op.drop_table('world_templates')
