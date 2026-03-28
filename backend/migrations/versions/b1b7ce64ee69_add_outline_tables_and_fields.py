"""add outline tables and fields

Revision ID: b1b7ce64ee69
Revises: character_system_001
Create Date: 2026-03-27 22:49:29.272779

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b1b7ce64ee69'
down_revision: Union[str, None] = 'character_system_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. 创建 story_events 表
    if 'story_events' not in inspector.get_table_names():
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

    # 2. 创建 event_connections 表
    if 'event_connections' not in inspector.get_table_names():
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

    # 3. 给 folders 表添加 outline_content 字段
    columns = [col['name'] for col in inspector.get_columns('folders')]
    if 'outline_content' not in columns:
        with op.batch_alter_table('folders', schema=None) as batch_op:
            batch_op.add_column(sa.Column('outline_content', sa.Text(), nullable=True, comment='大纲内容(HTML)'))

    # 4. 给 notes 表添加 outline_content 字段
    columns = [col['name'] for col in inspector.get_columns('notes')]
    if 'outline_content' not in columns:
        with op.batch_alter_table('notes', schema=None) as batch_op:
            batch_op.add_column(sa.Column('outline_content', sa.Text(), nullable=True, comment='大纲内容(HTML)'))


def downgrade() -> None:
    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.drop_column('outline_content')

    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_column('outline_content')

    op.drop_index('ix_event_connections_to_event_id', table_name='event_connections')
    op.drop_index('ix_event_connections_from_to', table_name='event_connections')
    op.drop_index('ix_event_connections_from_event_id', table_name='event_connections')
    op.drop_table('event_connections')

    op.drop_index('ix_story_events_project_id', table_name='story_events')
    op.drop_index('ix_story_events_act_order', table_name='story_events')
    op.drop_index('ix_story_events_act_id', table_name='story_events')
    op.drop_table('story_events')
