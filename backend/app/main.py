from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.logging import setup_logging, get_logger
from app.core.config import settings

setup_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)

from app.api import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting up...")
    yield
    logger.info("Application shutting down...")


app = FastAPI(
    title="LocalScribe API",
    description="本地写作助手后端 API",
    version="1.0.0",
    lifespan=lifespan
)

# 配置 CORS（允许前端开发服务器访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite 默认开发服务器端口
        "http://127.0.0.1:5173",
        # 如有其他前端地址可添加
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/")
@app.get("/health")
async def health_check():
    logger.debug("Health check endpoint called")
    return {"status": "ok", "message": "LocalScribe API is running"}