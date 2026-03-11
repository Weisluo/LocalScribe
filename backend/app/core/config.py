from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    """应用配置类，从环境变量或.env文件加载配置"""

    # 数据库连接URL，默认使用SQLite
    DATABASE_URL: str = "sqlite:///./data/writing_assistant.db"

    # 配置从.env文件加载
    model_config = ConfigDict(
        env_file=".env",          # 指定.env文件
        env_file_encoding="utf-8",
        case_sensitive=False      # 环境变量大小写不敏感
    )


# 创建全局配置实例
settings = Settings()