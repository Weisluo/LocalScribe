# backend/app/schemas/ai.py
from pydantic import BaseModel
from typing import Optional, List

class AIGenerateRequest(BaseModel):
    prompt: str
    model: Optional[str] = None  #允许前端指定模型
    context: Optional[str] = None
    stream: bool = False
    action: Optional[str] = "generate"

class AIGenerateResponse(BaseModel):
    text: str

class ModelInfo(BaseModel):
    name: str

class ModelListResponse(BaseModel):
    models: List[ModelInfo]
