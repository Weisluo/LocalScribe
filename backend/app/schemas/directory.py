from typing import List, Optional, Literal, Union
from datetime import datetime
from pydantic import BaseModel

# 定义树节点的联合类型，使用 Literal 区分类型
# 这是 API 设计文档中树节点结构的 Pydantic 实现

class VolumeNode(BaseModel):
    type: Literal["volume"] = "volume"
    id: str
    name: str
    order: int
    children: List["ActNode"] = []

class ActNode(BaseModel):
    type: Literal["act"] = "act"
    id: str
    name: str
    order: int
    children: List["NoteNode"] = []

class NoteNode(BaseModel):
    type: Literal["note"] = "note"
    id: str
    title: str # 注意：章节用 title，文件夹用 name
    order: int
    created_at: datetime

# 为了支持递归引用，需要更新模型的前向引用
VolumeNode.model_rebuild()
ActNode.model_rebuild()

# 统一的响应类型
DirectoryTree = List[VolumeNode]
