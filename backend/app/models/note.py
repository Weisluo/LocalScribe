import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from sqlalchemy import DateTime, String, Text, Integer, ForeignKey, JSON, Enum as SA_Enum, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from . import Base

class NoteStatus(str, Enum):
    draft = "draft"
    revising = "revising"
    completed = "completed"

class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    title: Mapped[str] = mapped_column(String(255), nullable=False, comment="章节标题")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="章节内容")

    folder_id: Mapped[str] = mapped_column(String(36), ForeignKey("folders.id"), nullable=False, index=True, comment="所属幕ID")
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True, comment="所属项目ID")

    order: Mapped[int] = mapped_column(Integer, default=0, index=True, comment="排序序号")

    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, comment="标签")
    word_count: Mapped[Optional[int]] = mapped_column(Integer, default=0, comment="字数")
    status: Mapped[NoteStatus] = mapped_column(SA_Enum(NoteStatus), default=NoteStatus.draft, index=True, comment="状态")

    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True, comment="删除时间")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    project: Mapped["Project"] = relationship(back_populates="notes")
    folder: Mapped["Folder"] = relationship(back_populates="notes")

    __table_args__ = (
        Index('ix_notes_folder_order', 'folder_id', 'order'),
        Index('ix_notes_project_deleted', 'project_id', 'deleted_at'),
    )

    def __repr__(self) -> str:
        return f"<Note {self.title}>"
