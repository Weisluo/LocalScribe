# backend/app/core/config.py
import os
from pydantic_settings import BaseSettings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "local_scribe.db")

class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{DB_PATH}"
    
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3.5:9b"
    
    LOG_LEVEL: str = "INFO"
    
    DATABASE_ECHO: bool = False

    class Config:
        env_file = ".env"

settings = Settings()