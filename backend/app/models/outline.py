import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from sqlalchemy import DateTime, String, Text, Integer, Float, Boolean, ForeignKey, JSON, Enum as SA_Enum, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from . import Base


class EventType(str, Enum):
    normal = "normal"
    decision = "decision"
    milestone = "milestone"
    flashback = "flashback"
    flashforward = "flashforward"


class ConnectionType(str, Enum):
    direct = "direct"
    branch = "branch"
    parallel = "parallel"
    merge = "merge"
    loop = "loop"
    jump = "jump"


class StoryEvent(Base):
    __tablename__ = "story_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    act_id: Mapped[str] = mapped_column(String(36), ForeignKey("folders.id"), nullable=False, index=True, comment="所属幕ID")
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True, comment="所属项目ID")

    title: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="事件标题")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="事件内容简述")
    event_type: Mapped[EventType] = mapped_column(SA_Enum(EventType), default=EventType.normal, comment="事件类型")

    characters: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, comment="参与角色ID列表")
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="地点")
    timestamp: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="时间标记")

    order: Mapped[int] = mapped_column(Integer, default=0, comment="排序序号")

    # 视觉位置
    position_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="X坐标")
    position_y: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Y坐标")
    lane: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="泳道编号")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    act: Mapped["Folder"] = relationship(foreign_keys=[act_id])
    project: Mapped["Project"] = relationship(foreign_keys=[project_id])
    outgoing_connections: Mapped[List["EventConnection"]] = relationship(
        back_populates="from_event",
        foreign_keys="EventConnection.from_event_id",
        cascade="all, delete-orphan"
    )
    incoming_connections: Mapped[List["EventConnection"]] = relationship(
        back_populates="to_event",
        foreign_keys="EventConnection.to_event_id",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index('ix_story_events_act_order', 'act_id', 'order'),
        Index('ix_story_events_project', 'project_id'),
    )

    def __repr__(self) -> str:
        return f"<StoryEvent {self.title}>"


class EventConnection(Base):
    __tablename__ = "event_connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    from_event_id: Mapped[str] = mapped_column(String(36), ForeignKey("story_events.id", ondelete="CASCADE"), nullable=False, index=True, comment="源事件ID")
    to_event_id: Mapped[str] = mapped_column(String(36), ForeignKey("story_events.id", ondelete="CASCADE"), nullable=False, index=True, comment="目标事件ID")

    connection_type: Mapped[ConnectionType] = mapped_column(SA_Enum(ConnectionType), default=ConnectionType.direct, comment="连接类型")
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="连接标签")
    condition: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="条件描述")

    # 样式
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="线条颜色")
    dashed: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否虚线")
    thickness: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="线条粗细")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    from_event: Mapped["StoryEvent"] = relationship(
        back_populates="outgoing_connections",
        foreign_keys=[from_event_id]
    )
    to_event: Mapped["StoryEvent"] = relationship(
        back_populates="incoming_connections",
        foreign_keys=[to_event_id]
    )

    __table_args__ = (
        Index('ix_event_connections_from_to', 'from_event_id', 'to_event_id'),
    )

    def __repr__(self) -> str:
        return f"<EventConnection {self.from_event_id} -> {self.to_event_id}>"
