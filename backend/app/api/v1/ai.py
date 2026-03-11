# backend/app/api/v1/ai.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator

from app.schemas import AIGenerateRequest, AIGenerateResponse
from app.services.ai_service import ai_service

router = APIRouter()

@router.post("/generate", response_model=AIGenerateResponse)
async def generate_text(request: AIGenerateRequest):
    """生成文本（非流式）"""
    try:
        # 组装 Prompt (这里可以优化为模板)
        full_prompt = request.prompt
        if request.context:
            full_prompt = f"背景上下文：\n{request.context}\n\n任务：\n{request.prompt}"

        result = await ai_service.generate_text(full_prompt, stream=False)
        
        # 如果返回的是生成器（虽然我们传了 False，但类型检查需要处理）
        if isinstance(result, AsyncGenerator):
            raise HTTPException(status_code=500, detail="Unexpected stream response")
            
        return AIGenerateResponse(text=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate/stream")
async def generate_text_stream(request: AIGenerateRequest):
    """生成文本（流式）"""
    full_prompt = request.prompt
    if request.context:
        full_prompt = f"背景上下文：\n{request.context}\n\n任务：\n{request.prompt}"

    generator = await ai_service.generate_text(full_prompt, stream=True)
    
    # 返回 StreamingResponse
    return StreamingResponse(generator, media_type="text/event-stream")
