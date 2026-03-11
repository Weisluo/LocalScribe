# backend/app/core/config.py
import os
from pydantic_settings import BaseSettings

# 获取 backend 目录的绝对路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "local_scribe.db")

class Settings(BaseSettings):
    # 数据库配置
    DATABASE_URL: str = f"sqlite:///{DB_PATH}"
    
    # Ollama 配置
    OLLAMA_BASE_URL: str = "http://localhost:11434" # Ollama 默认地址
    OLLAMA_MODEL: str = "qwen3.5:9b" # 默认模型，你可以改成你本地有的模型，如 llama3, mistral 等

    class Config:
        env_file = ".env"

settings = Settings()