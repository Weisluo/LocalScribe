import uuid
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from . import Base

if TYPE_CHECKING:
    from .relation import BidirectionalRelation
    from .character import Character

class Project(Base):
    __tablename__ = "projects"

    # 主键，使用 UUID 字符串形式
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    title: Mapped[str] = mapped_column(String(255), nullable=False, comment="小说名称")
    genre: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, comment="题材")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="简介")
    cover: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="封面URL")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="更新时间",
    )

    # 定义关联关系（方便后续查询，可选但推荐）
    folders: Mapped[List["Folder"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    notes: Mapped[List["Note"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    world_instances: Mapped[List["WorldInstance"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    world_templates: Mapped[List["WorldTemplate"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    relations: Mapped[List["BidirectionalRelation"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="select"
    )
    characters: Mapped[List["Character"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Project {self.title}>"
