# backend/app/core/dependencies.py
from typing import Generator
from sqlalchemy.orm import Session

# 导入我们在 database.py 中创建的 SessionLocal
from app.core.database import SessionLocal

def get_db() -> Generator:
    """
    依赖项：获取数据库会话
    FastAPI 会在请求进来时调用此函数，并在请求结束后执行 yield 后的代码关闭连接
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
