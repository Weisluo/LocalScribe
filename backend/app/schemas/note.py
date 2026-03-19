from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from enum import Enum

# 章节状态枚举
class NoteStatus(str, Enum):
    draft = "draft"
    revising = "revising"
    completed = "completed"

class NoteBase(BaseModel):
    title: str
    content: Optional[str] = ""
    tags: Optional[List[str]] = None
    status: Optional[NoteStatus] = NoteStatus.draft

class NoteCreate(NoteBase):
    folder_id: str
    project_id: str
    order: Optional[int] = 0

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None # 用于移动章节
    tags: Optional[List[str]] = None
    status: Optional[NoteStatus] = None

class NoteResponse(NoteBase):
    id: str
    folder_id: str
    project_id: str
    order: int
    word_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
