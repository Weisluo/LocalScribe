from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from enum import Enum

# 文件夹类型枚举（与模型对应）
class FolderType(str, Enum):
    volume = "volume"
    act = "act"

class FolderBase(BaseModel):
    name: str
    type: FolderType
    parent_id: Optional[str] = None

class FolderCreate(FolderBase):
    project_id: str
    order: Optional[int] = 0 # 可选，后端可自动处理

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None # 用于拖拽移动

class FolderResponse(FolderBase):
    id: str
    project_id: str
    order: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
