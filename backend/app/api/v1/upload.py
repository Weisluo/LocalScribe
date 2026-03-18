# backend/app/api/v1/upload.py
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

# 确保上传目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "images"), exist_ok=True)


class UploadResponse(BaseModel):
    """文件上传响应"""
    success: bool = Field(..., description="是否上传成功")
    filename: str = Field(..., description="原始文件名")
    url: str = Field(..., description="文件访问 URL")
    size: int = Field(..., description="文件大小（字节）")
    content_type: str = Field(..., description="文件类型")
    message: Optional[str] = Field(None, description="提示信息")


class UploadError(BaseModel):
    """上传错误响应"""
    detail: str = Field(..., description="错误详情")


def validate_image_file(content_type: str, filename: str) -> bool:
    """验证文件是否为允许的图片类型"""
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = os.path.splitext(filename.lower())[1]
    return content_type in settings.ALLOWED_IMAGE_TYPES and ext in allowed_extensions


def generate_unique_filename(original_filename: str) -> str:
    """生成唯一的文件名"""
    ext = os.path.splitext(original_filename)[1].lower()
    unique_id = str(uuid.uuid4())[:8]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{timestamp}_{unique_id}{ext}"


@router.post(
    "/images",
    response_model=UploadResponse,
    responses={
        400: {"model": UploadError, "description": "文件验证失败"},
        413: {"model": UploadError, "description": "文件过大"},
        500: {"model": UploadError, "description": "服务器错误"}
    },
    summary="上传图片",
    description="上传图片文件（支持 JPG、PNG、GIF、WebP 格式，最大 10MB）"
)
async def upload_image(
    file: UploadFile = File(..., description="要上传的图片文件"),
    folder: Optional[str] = Form("images", description="存储子目录（默认 images）")
):
    """
    上传图片文件
    
    - **file**: 图片文件（必需）
    - **folder**: 存储子目录，默认为 "images"
    
    返回上传成功的文件信息，包括访问 URL
    """
    try:
        # 验证文件类型
        if not validate_image_file(file.content_type, file.filename):
            logger.warning(f"Invalid file type: {file.content_type}, filename: {file.filename}")
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型。只允许: JPEG, PNG, GIF, WebP"
            )
        
        # 读取文件内容
        content = await file.read()
        file_size = len(content)
        
        # 验证文件大小
        if file_size > settings.MAX_UPLOAD_SIZE:
            logger.warning(f"File too large: {file_size} bytes")
            raise HTTPException(
                status_code=413,
                detail=f"文件过大。最大允许: {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
            )
        
        # 生成唯一文件名
        unique_filename = generate_unique_filename(file.filename)
        
        # 构建存储路径
        target_dir = os.path.join(settings.UPLOAD_DIR, folder)
        os.makedirs(target_dir, exist_ok=True)
        
        file_path = os.path.join(target_dir, unique_filename)
        
        # 保存文件
        with open(file_path, "wb") as f:
            f.write(content)
        
        # 构建访问 URL
        file_url = f"/api/v1/upload/files/{folder}/{unique_filename}"
        
        logger.info(f"Image uploaded successfully: {file.filename} -> {unique_filename}")
        
        return UploadResponse(
            success=True,
            filename=file.filename,
            url=file_url,
            size=file_size,
            content_type=file.content_type,
            message="上传成功"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")
    finally:
        # 确保文件对象被正确关闭
        await file.close()


@router.get(
    "/files/{folder}/{filename}",
    summary="获取上传的文件",
    description="通过 URL 访问上传的文件"
)
async def get_uploaded_file(folder: str, filename: str):
    """
    获取上传的文件
    
    - **folder**: 文件所在目录
    - **filename**: 文件名
    """
    # 验证 folder 和 filename 不包含路径遍历字符
    if ".." in folder or ".." in filename or "/" in filename or "\\" in filename:
        logger.warning(f"Attempted path traversal: folder={folder}, filename={filename}")
        raise HTTPException(status_code=403, detail="访问被拒绝")
    
    file_path = os.path.join(settings.UPLOAD_DIR, folder, filename)
    
    # 安全检查：确保文件路径在 UPLOAD_DIR 内
    real_upload_dir = os.path.realpath(settings.UPLOAD_DIR)
    
    # 先检查文件是否存在，避免 realpath 对不存在的文件返回原路径
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    real_path = os.path.realpath(file_path)
    
    if not real_path.startswith(real_upload_dir):
        logger.warning(f"Attempted path traversal: {filename}")
        raise HTTPException(status_code=403, detail="访问被拒绝")
    
    return FileResponse(file_path)


@router.delete(
    "/files/{folder}/{filename}",
    summary="删除上传的文件",
    description="删除已上传的文件"
)
async def delete_uploaded_file(folder: str, filename: str):
    """
    删除上传的文件
    
    - **folder**: 文件所在目录
    - **filename**: 文件名
    """
    # 验证 folder 和 filename 不包含路径遍历字符
    if ".." in folder or ".." in filename or "/" in filename or "\\" in filename:
        logger.warning(f"Attempted path traversal in delete: folder={folder}, filename={filename}")
        raise HTTPException(status_code=403, detail="访问被拒绝")
    
    file_path = os.path.join(settings.UPLOAD_DIR, folder, filename)
    
    # 安全检查
    real_upload_dir = os.path.realpath(settings.UPLOAD_DIR)
    
    # 先检查文件是否存在，避免 realpath 对不存在的文件返回原路径
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    real_path = os.path.realpath(file_path)
    
    if not real_path.startswith(real_upload_dir):
        logger.warning(f"Attempted path traversal in delete: {filename}")
        raise HTTPException(status_code=403, detail="访问被拒绝")
    
    try:
        os.remove(file_path)
        logger.info(f"File deleted: {file_path}")
        return {"success": True, "message": "文件已删除"}
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
