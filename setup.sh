#!/bin/bash

set -e  # 遇到错误立即退出

echo "========================================"
echo "  写作助手项目依赖安装脚本 (WSL2适配)"
echo "========================================"

# 检查必要命令
command -v python3 >/dev/null 2>&1 || { echo "需要 Python3 但未安装，请先安装 Python3。"; exit 1; }
command -v pip3 >/dev/null 2>&1 || { echo "需要 pip3 但未安装，请先安装 pip3。"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "需要 npm 但未安装，请先安装 Node.js 和 npm。"; exit 1; }

# 后端依赖安装
echo ""
echo "[1/4] 设置 Python 虚拟环境并安装后端依赖..."
cd backend

# 检查是否安装了 python3-venv（用于创建虚拟环境）
if ! python3 -c "import venv" &>/dev/null; then
    echo "错误: 未找到 venv 模块，请先安装 python3-venv："
    echo "  sudo apt update && sudo apt install python3-venv"
    exit 1
fi

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo "创建虚拟环境 venv..."
    python3 -m venv venv
fi

# 直接使用虚拟环境中的 pip 安装依赖（无需 source 激活）
echo "安装后端依赖到虚拟环境..."
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt
venv/bin/pip install -r requirements-dev.txt

# 创建数据库目录
mkdir -p data

cd ..

# 前端依赖安装
echo ""
echo "[2/4] 安装前端 Node.js 依赖..."
cd frontend

if [ ! -f "package.json" ]; then
    echo "错误: 未找到 frontend/package.json"
    exit 1
fi

npm install

cd ..

echo ""
echo "[3/4] 创建必要的目录..."
mkdir -p backend/data

# --- 数据库迁移 ---
echo ""
echo "[4/4] 初始化数据库..."
cd backend
venv/bin/alembic upgrade head
cd ..

echo ""
echo "========================================"
echo "✅ 所有依赖安装完成！"
echo ""
echo "下一步："
echo "  1. 激活后端虚拟环境："
echo "     source backend/venv/bin/activate"
echo "  2. 启动后端服务器："
echo "     uvicorn app.main:app --reload"
echo "  3. 新开终端，进入前端目录启动前端："
echo "     cd frontend && npm run dev"
echo ""
echo "访问前端: http://localhost:5173"
echo "访问后端API文档: http://localhost:8000/docs"
echo "========================================"