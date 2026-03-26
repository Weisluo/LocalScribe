"""add_character_system_tables

Revision ID: character_system_001
Revises: 25676bc12c35
Create Date: 2026-03-26 18:00:15.043114

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'character_system_001'
down_revision: Union[str, None] = '25676bc12c35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    existing_tables = inspector.get_table_names()
    
    if 'characters' not in existing_tables:
        op.create_table(
            'characters',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('project_id', sa.String(length=36), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False, comment='姓名'),
            sa.Column('gender', sa.String(length=20), nullable=False, comment='性别'),
            sa.Column('birth_date', sa.String(length=100), nullable=True, comment='生辰'),
            sa.Column('birthplace', sa.String(length=255), nullable=True, comment='出生地'),
            sa.Column('level', sa.String(length=20), nullable=False, comment='角色等级'),
            sa.Column('quote', sa.Text(), nullable=True, comment='判词/引言'),
            sa.Column('avatar', sa.String(length=500), nullable=True, comment='头像URL'),
            sa.Column('full_image', sa.String(length=500), nullable=True, comment='全身形象图片URL'),
            sa.Column('first_appearance_volume', sa.String(length=100), nullable=True, comment='首次出场卷'),
            sa.Column('first_appearance_act', sa.String(length=100), nullable=True, comment='首次出场幕'),
            sa.Column('first_appearance_chapter', sa.String(length=100), nullable=True, comment='首次出场章'),
            sa.Column('order_index', sa.Integer(), nullable=False, comment='排序索引'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        
        with op.batch_alter_table('characters', schema=None) as batch_op:
            batch_op.create_foreign_key(
                'fk_characters_project_id_projects',
                'projects',
                ['project_id'],
                ['id'],
                ondelete='CASCADE'
            )
            batch_op.create_index('ix_characters_project_id', ['project_id'], unique=False)
            batch_op.create_index('ix_characters_name', ['name'], unique=False)
    
    if 'character_aliases' not in existing_tables:
        op.create_table(
            'character_aliases',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('character_id', sa.String(length=36), nullable=False),
            sa.Column('alias_type', sa.String(length=50), nullable=False, comment='别名类型'),
            sa.Column('content', sa.String(length=255), nullable=False, comment='别名内容'),
            sa.Column('order_index', sa.Integer(), nullable=False, comment='排序索引'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        
        with op.batch_alter_table('character_aliases', schema=None) as batch_op:
            batch_op.create_foreign_key(
                'fk_character_aliases_character_id_characters',
                'characters',
                ['character_id'],
                ['id'],
                ondelete='CASCADE'
            )
            batch_op.create_index('ix_character_aliases_character_id', ['character_id'], unique=False)
    
    if 'character_cards' not in existing_tables:
        op.create_table(
            'character_cards',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('character_id', sa.String(length=36), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False, comment='卡片标题'),
            sa.Column('icon', sa.String(length=100), nullable=True, comment='卡片图标'),
            sa.Column('content', sa.JSON(), nullable=True, comment='卡片内容'),
            sa.Column('order_index', sa.Integer(), nullable=False, comment='排序索引'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        
        with op.batch_alter_table('character_cards', schema=None) as batch_op:
            batch_op.create_foreign_key(
                'fk_character_cards_character_id_characters',
                'characters',
                ['character_id'],
                ['id'],
                ondelete='CASCADE'
            )
            batch_op.create_index('ix_character_cards_character_id', ['character_id'], unique=False)
    
    if 'character_relationships' not in existing_tables:
        op.create_table(
            'character_relationships',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('character_id', sa.String(length=36), nullable=False),
            sa.Column('target_character_id', sa.String(length=36), nullable=True),
            sa.Column('target_name', sa.String(length=255), nullable=True, comment='目标人物名称'),
            sa.Column('relation_type', sa.String(length=50), nullable=False, comment='关系类型'),
            sa.Column('description', sa.Text(), nullable=True, comment='关系描述'),
            sa.Column('strength', sa.Integer(), nullable=False, comment='关系强度 0-100'),
            sa.Column('is_bidirectional', sa.Boolean(), nullable=False, comment='是否为双向关系'),
            sa.Column('reverse_description', sa.Text(), nullable=True, comment='反向关系描述'),
            sa.Column('order_index', sa.Integer(), nullable=False, comment='排序索引'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        
        with op.batch_alter_table('character_relationships', schema=None) as batch_op:
            batch_op.create_foreign_key(
                'fk_character_relationships_character_id_characters',
                'characters',
                ['character_id'],
                ['id'],
                ondelete='CASCADE'
            )
            batch_op.create_foreign_key(
                'fk_character_relationships_target_character_id_characters',
                'characters',
                ['target_character_id'],
                ['id'],
                ondelete='SET NULL'
            )
            batch_op.create_index('ix_character_relationships_character_id', ['character_id'], unique=False)
            batch_op.create_index('ix_character_relationships_target_character_id', ['target_character_id'], unique=False)
    
    if 'character_artifacts' not in existing_tables:
        op.create_table(
            'character_artifacts',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('character_id', sa.String(length=36), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False, comment='器物名称'),
            sa.Column('description', sa.Text(), nullable=True, comment='器物描述'),
            sa.Column('artifact_type', sa.String(length=100), nullable=True, comment='器物类型'),
            sa.Column('image', sa.String(length=500), nullable=True, comment='器物图片URL'),
            sa.Column('order_index', sa.Integer(), nullable=False, comment='排序索引'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        
        with op.batch_alter_table('character_artifacts', schema=None) as batch_op:
            batch_op.create_foreign_key(
                'fk_character_artifacts_character_id_characters',
                'characters',
                ['character_id'],
                ['id'],
                ondelete='CASCADE'
            )
            batch_op.create_index('ix_character_artifacts_character_id', ['character_id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'character_artifacts' in existing_tables:
        with op.batch_alter_table('character_artifacts', schema=None) as batch_op:
            batch_op.drop_index('ix_character_artifacts_character_id')
            batch_op.drop_constraint('fk_character_artifacts_character_id_characters', type_='foreignkey')
        op.drop_table('character_artifacts')
    
    if 'character_relationships' in existing_tables:
        with op.batch_alter_table('character_relationships', schema=None) as batch_op:
            batch_op.drop_index('ix_character_relationships_target_character_id')
            batch_op.drop_index('ix_character_relationships_character_id')
            batch_op.drop_constraint('fk_character_relationships_target_character_id_characters', type_='foreignkey')
            batch_op.drop_constraint('fk_character_relationships_character_id_characters', type_='foreignkey')
        op.drop_table('character_relationships')
    
    if 'character_cards' in existing_tables:
        with op.batch_alter_table('character_cards', schema=None) as batch_op:
            batch_op.drop_index('ix_character_cards_character_id')
            batch_op.drop_constraint('fk_character_cards_character_id_characters', type_='foreignkey')
        op.drop_table('character_cards')
    
    if 'character_aliases' in existing_tables:
        with op.batch_alter_table('character_aliases', schema=None) as batch_op:
            batch_op.drop_index('ix_character_aliases_character_id')
            batch_op.drop_constraint('fk_character_aliases_character_id_characters', type_='foreignkey')
        op.drop_table('character_aliases')
    
    if 'characters' in existing_tables:
        with op.batch_alter_table('characters', schema=None) as batch_op:
            batch_op.drop_index('ix_characters_name')
            batch_op.drop_index('ix_characters_project_id')
            batch_op.drop_constraint('fk_characters_project_id_projects', type_='foreignkey')
        op.drop_table('characters')
