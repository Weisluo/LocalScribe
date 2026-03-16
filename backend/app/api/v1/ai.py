# backend/app/api/v1/ai.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import httpx

from app.schemas import AIGenerateRequest, AIGenerateResponse
from app.services.ai_service import ai_service
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

@router.post("/generate", response_model=AIGenerateResponse)
async def generate_text(request: AIGenerateRequest):
    """生成文本（非流式）"""
    logger.info(f"AI generate request - prompt length: {len(request.prompt)}, model: {request.model}")
    try:
        full_prompt = request.prompt
        if request.context:
            full_prompt = f"背景上下文：\n{request.context}\n\n任务：\n{request.prompt}"

        result = await ai_service.generate_text(full_prompt, stream=False)
        
        if isinstance(result, AsyncGenerator):
            logger.error("Unexpected stream response for non-stream request")
            raise HTTPException(status_code=500, detail="Unexpected stream response")
        
        logger.info(f"AI generate success - response length: {len(result)}")
        return AIGenerateResponse(text=result)
    except httpx.TimeoutException:
        logger.error("AI service timeout")
        raise HTTPException(status_code=504, detail="AI服务响应超时")
    except httpx.RequestError as e:
        logger.error(f"AI service request error: {e}")
        raise HTTPException(status_code=503, detail="AI服务不可用")
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        raise HTTPException(status_code=500, detail="文本生成失败，请稍后重试")

@router.post("/generate/stream")
async def generate_text_stream(request: AIGenerateRequest):
    """生成文本（流式）"""
    logger.info(f"AI stream request - prompt length: {len(request.prompt)}")
    full_prompt = request.prompt
    if request.context:
        full_prompt = f"背景上下文：\n{request.context}\n\n任务：\n{request.prompt}"

    generator = await ai_service.generate_text(full_prompt, stream=True)
    
    return StreamingResponse(generator, media_type="text/event-stream")
