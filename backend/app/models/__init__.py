from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import MetaData

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)

Base = declarative_base(metadata=metadata)

# --- 导入所有模型，确保 Alembic 能扫描到 ---

# 注意：必须在 Base 定义之后导入
from .project import Project
from .folder import Folder
from .note import Note
from .worldbuilding import WorldTemplate, WorldModule, WorldSubmodule, WorldModuleItem, WorldInstance

__all__ = ["Base", "Project", "Folder", "Note", "WorldTemplate", "WorldModule", "WorldSubmodule", "WorldModuleItem", "WorldInstance"]
