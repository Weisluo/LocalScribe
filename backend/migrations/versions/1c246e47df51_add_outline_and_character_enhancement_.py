"""add outline and character enhancement features

Revision ID: 1c246e47df51
Revises: character_system_001
Create Date: 2026-03-29 22:15:19.666680

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '1c246e47df51'
down_revision: Union[str, None] = 'character_system_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'story_events' not in existing_tables:
        op.create_table('story_events',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('act_id', sa.String(length=36), nullable=False, comment='所属幕ID'),
            sa.Column('project_id', sa.String(length=36), nullable=False, comment='所属项目ID'),
            sa.Column('title', sa.String(length=255), nullable=False, comment='事件标题'),
            sa.Column('content', sa.Text(), nullable=False, comment='事件内容简述'),
            sa.Column('event_type', sa.Enum('normal', 'decision', 'milestone', 'flashback', 'flashforward', name='eventtype'), nullable=False, comment='事件类型'),
            sa.Column('characters', sa.JSON(), nullable=True, comment='参与角色ID列表'),
            sa.Column('location', sa.String(length=255), nullable=True, comment='地点'),
            sa.Column('timestamp', sa.String(length=100), nullable=True, comment='时间标记'),
            sa.Column('order', sa.Integer(), nullable=False, comment='排序序号'),
            sa.Column('position_x', sa.Float(), nullable=True, comment='X坐标'),
            sa.Column('position_y', sa.Float(), nullable=True, comment='Y坐标'),
            sa.Column('lane', sa.Integer(), nullable=True, comment='泳道编号'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['act_id'], ['folders.id'], name='fk_story_events_act_id_folders'),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_story_events_project_id_projects'),
            sa.PrimaryKeyConstraint('id', name='pk_story_events')
        )
        op.create_index('ix_story_events_act_id', 'story_events', ['act_id'], unique=False)
        op.create_index('ix_story_events_act_order', 'story_events', ['act_id', 'order'], unique=False)
        op.create_index('ix_story_events_project_id', 'story_events', ['project_id'], unique=False)

    if 'event_connections' not in existing_tables:
        op.create_table('event_connections',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('from_event_id', sa.String(length=36), nullable=False, comment='源事件ID'),
            sa.Column('to_event_id', sa.String(length=36), nullable=False, comment='目标事件ID'),
            sa.Column('connection_type', sa.Enum('direct', 'branch', 'parallel', 'merge', 'loop', 'jump', name='connectiontype'), nullable=False, comment='连接类型'),
            sa.Column('label', sa.String(length=255), nullable=True, comment='连接标签'),
            sa.Column('condition', sa.String(length=255), nullable=True, comment='条件描述'),
            sa.Column('color', sa.String(length=20), nullable=True, comment='线条颜色'),
            sa.Column('dashed', sa.Boolean(), nullable=False, comment='是否虚线'),
            sa.Column('thickness', sa.Float(), nullable=True, comment='线条粗细'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['from_event_id'], ['story_events.id'], name='fk_event_connections_from_event_id_story_events', ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['to_event_id'], ['story_events.id'], name='fk_event_connections_to_event_id_story_events', ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id', name='pk_event_connections')
        )
        op.create_index('ix_event_connections_from_event_id', 'event_connections', ['from_event_id'], unique=False)
        op.create_index('ix_event_connections_from_to', 'event_connections', ['from_event_id', 'to_event_id'], unique=False)
        op.create_index('ix_event_connections_to_event_id', 'event_connections', ['to_event_id'], unique=False)

    folders_columns = [col['name'] for col in inspector.get_columns('folders')]
    if 'outline_content' not in folders_columns:
        with op.batch_alter_table('folders', schema=None) as batch_op:
            batch_op.add_column(sa.Column('outline_content', sa.Text(), nullable=True, comment='大纲内容(HTML)'))

    notes_columns = [col['name'] for col in inspector.get_columns('notes')]
    with op.batch_alter_table('notes', schema=None) as batch_op:
        if 'outline_content' not in notes_columns:
            batch_op.add_column(sa.Column('outline_content', sa.Text(), nullable=True, comment='大纲内容(HTML)'))
        if 'scene_count' not in notes_columns:
            batch_op.add_column(sa.Column('scene_count', sa.Integer(), nullable=True, comment='场景数估计'))
        if 'outline_characters' not in notes_columns:
            batch_op.add_column(sa.Column('outline_characters', sa.JSON(), nullable=True, comment='出场角色ID列表'))

    characters_columns = [col['name'] for col in inspector.get_columns('characters')]
    with op.batch_alter_table('characters', schema=None) as batch_op:
        if 'race' not in characters_columns:
            batch_op.add_column(sa.Column('race', sa.String(length=100), nullable=True, comment='种族'))
        if 'faction' not in characters_columns:
            batch_op.add_column(sa.Column('faction', sa.String(length=100), nullable=True, comment='阵营归属'))
        if 'last_appearance_volume' not in characters_columns:
            batch_op.add_column(sa.Column('last_appearance_volume', sa.String(length=100), nullable=True, comment='最后出场卷'))
        if 'last_appearance_act' not in characters_columns:
            batch_op.add_column(sa.Column('last_appearance_act', sa.String(length=100), nullable=True, comment='最后出场幕'))
        if 'last_appearance_chapter' not in characters_columns:
            batch_op.add_column(sa.Column('last_appearance_chapter', sa.String(length=100), nullable=True, comment='最后出场章'))

    artifacts_columns = [col['name'] for col in inspector.get_columns('character_artifacts')]
    with op.batch_alter_table('character_artifacts', schema=None) as batch_op:
        if 'quote' not in artifacts_columns:
            batch_op.add_column(sa.Column('quote', sa.String(length=500), nullable=True, comment='器物判词'))
        if 'rarity' not in artifacts_columns:
            batch_op.add_column(sa.Column('rarity', sa.String(length=20), nullable=True, comment='器物等级: legendary(神器), epic(传说), rare(稀有), common(普通)'))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    with op.batch_alter_table('character_artifacts', schema=None) as batch_op:
        batch_op.drop_column('rarity')
        batch_op.drop_column('quote')

    with op.batch_alter_table('characters', schema=None) as batch_op:
        batch_op.drop_column('last_appearance_chapter')
        batch_op.drop_column('last_appearance_act')
        batch_op.drop_column('last_appearance_volume')
        batch_op.drop_column('faction')
        batch_op.drop_column('race')

    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.drop_column('outline_characters')
        batch_op.drop_column('scene_count')
        batch_op.drop_column('outline_content')

    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_column('outline_content')

    if 'event_connections' in existing_tables:
        op.drop_index('ix_event_connections_to_event_id', table_name='event_connections')
        op.drop_index('ix_event_connections_from_to', table_name='event_connections')
        op.drop_index('ix_event_connections_from_event_id', table_name='event_connections')
        op.drop_table('event_connections')

    if 'story_events' in existing_tables:
        op.drop_index('ix_story_events_project_id', table_name='story_events')
        op.drop_index('ix_story_events_act_order', table_name='story_events')
        op.drop_index('ix_story_events_act_id', table_name='story_events')
        op.drop_table('story_events')
