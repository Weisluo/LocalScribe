from datetime import datetime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import MetaData

# 定义命名约定，这对于数据库约束命名非常有用
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

# 创建元数据对象
metadata = MetaData(naming_convention=convention)

# 声明基类
class Base(DeclarativeBase):
    pass

# --- 导入所有模型，确保 Alembic 能扫描到 ---

# 注意：必须在 Base 定义之后导入
from .project import Project
from .folder import Folder
from .note import Note

__all__ = ["Base", "Project", "Folder", "Note"]
