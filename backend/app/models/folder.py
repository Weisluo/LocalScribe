import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional
from sqlalchemy import String, Integer, ForeignKey, Enum as SA_Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from . import Base

# 定义枚举类型
class FolderType(str, Enum):
    volume = "volume" # 卷
    act = "act"       # 幕

class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="卷名或幕名")
    type: Mapped[FolderType] = mapped_column(SA_Enum(FolderType), nullable=False, comment="类型")
    
    # 父文件夹ID：卷的 parentId 为 null，幕的 parentId 指向卷ID
    parent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("folders.id"), nullable=True, index=True, comment="父文件夹ID")
    
    # 外键关联项目
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True, comment="所属项目ID")
    
    order: Mapped[int] = mapped_column(Integer, default=0, comment="排序序号")
    
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联关系
    project: Mapped["Project"] = relationship(back_populates="folders")
    # 自引用关联：一个文件夹(卷)下可以有多个子文件夹(幕)
    children: Mapped[List["Folder"]] = relationship(back_populates="parent", remote_side=[id])
    parent: Mapped[Optional["Folder"]] = relationship(back_populates="children", remote_side=[parent_id])
    # 包含的笔记
    notes: Mapped[List["Note"]] = relationship(back_populates="folder", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Folder ({self.type}) {self.name}>"
