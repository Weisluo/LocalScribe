from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

# 基础模型，包含公共字段
class ProjectBase(BaseModel):
    title: str
    genre: Optional[List[str]] = None
    description: Optional[str] = None
    cover: Optional[str] = None

# 创建时的模型（不需要 id 和时间戳）
class ProjectCreate(ProjectBase):
    pass

# 更新时的模型（所有字段可选）
class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[List[str]] = None
    description: Optional[str] = None
    cover: Optional[str] = None

# 响应模型（返回给前端时使用，包含 id 和时间戳）
class ProjectResponse(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime

    # Pydantic V2 配置：允许从 ORM 模型转换
    model_config = ConfigDict(from_attributes=True)
