import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from sqlalchemy import DateTime, String, Text, Integer, ForeignKey, Enum as SA_Enum, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from . import Base

class FolderType(str, Enum):
    volume = "volume"
    act = "act"

class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="卷名或幕名")
    type: Mapped[FolderType] = mapped_column(SA_Enum(FolderType), nullable=False, index=True, comment="类型")

    parent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("folders.id"), nullable=True, index=True, comment="父文件夹ID")

    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True, comment="所属项目ID")

    order: Mapped[int] = mapped_column(Integer, default=0, index=True, comment="排序序号")

    outline_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None, comment="大纲内容(HTML)")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    project: Mapped["Project"] = relationship(back_populates="folders")
    children: Mapped[List["Folder"]] = relationship(back_populates="parent", remote_side=[id])
    parent: Mapped[Optional["Folder"]] = relationship(back_populates="children", remote_side=[parent_id])
    notes: Mapped[List["Note"]] = relationship(back_populates="folder", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_folders_project_type', 'project_id', 'type'),
    )

    def __repr__(self) -> str:
        return f"<Folder ({self.type}) {self.name}>"
