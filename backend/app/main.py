from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 创建 FastAPI 应用实例
app = FastAPI(
    title="LocalScribe API",
    description="本地写作助手后端 API",
    version="1.0.0",
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

# 健康检查路由
@app.get("/")
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "LocalScribe API is running"}

# 可选：添加启动/关闭事件
@app.on_event("startup")
async def startup_event():
    print("应用启动中...")

@app.on_event("shutdown")
async def shutdown_event():
    print("应用关闭中...")