# backend/app/core/config.py
import os
from pydantic_settings import BaseSettings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "local_scribe.db")

# 上传文件配置
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{DB_PATH}"
    
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3.5:9b"
    
    LOG_LEVEL: str = "INFO"
    
    DATABASE_ECHO: bool = False
    
    # 文件上传配置
    UPLOAD_DIR: str = UPLOAD_DIR
    MAX_UPLOAD_SIZE: int = MAX_UPLOAD_SIZE
    ALLOWED_IMAGE_TYPES: set = ALLOWED_IMAGE_TYPES

    class Config:
        env_file = ".env"

settings = Settings()