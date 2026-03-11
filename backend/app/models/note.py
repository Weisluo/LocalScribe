import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional
from sqlalchemy import String, Text, Integer, ForeignKey, JSON, Enum as SA_Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from . import Base

# 定义状态枚举
class NoteStatus(str, Enum):
    draft = "draft"         # 草稿
    revising = "revising"   # 修改中
    completed = "completed" # 定稿

class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    title: Mapped[str] = mapped_column(String(255), nullable=False, comment="章节标题")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="章节内容")
    
    # 外键：所属幕 (API设计要求必须指向 type='act' 的文件夹)
    folder_id: Mapped[str] = mapped_column(String(36), ForeignKey("folders.id"), nullable=False, index=True, comment="所属幕ID")
    # 外键：所属项目 (冗余字段，便于查询)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True, comment="所属项目ID")
    
    order: Mapped[int] = mapped_column(Integer, default=0, comment="排序序号")
    
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, comment="标签")
    word_count: Mapped[Optional[int]] = mapped_column(Integer, default=0, comment="字数")
    status: Mapped[NoteStatus] = mapped_column(SA_Enum(NoteStatus), default=NoteStatus.draft, comment="状态")
    
    # 软删除标记（为后续回收站功能预留）
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, comment="删除时间")
    
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联关系
    project: Mapped["Project"] = relationship(back_populates="notes")
    folder: Mapped["Folder"] = relationship(back_populates="notes")

    def __repr__(self) -> str:
        return f"<Note {self.title}>"
