#!/bin/bash

set -euo pipefail

# 颜色定义
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# 项目根目录（脚本所在目录）
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKEND_DIR="$PROJECT_ROOT/backend"
readonly FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 包管理器检测
 detect_package_manager() {
    if command -v apt-get &>/dev/null; then
        echo "apt"
    elif command -v yum &>/dev/null; then
        echo "yum"
    elif command -v dnf &>/dev/null; then
        echo "dnf"
    elif command -v pacman &>/dev/null; then
        echo "pacman"
    else
        echo "unknown"
    fi
}

readonly PKG_MANAGER=$(detect_package_manager)

# 打印函数
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[$1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

# 错误处理函数
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        print_error "安装过程中出现错误 (退出码: $exit_code)"
    fi
    exit $exit_code
}

trap cleanup EXIT

# 检查网络连接
check_network() {
    if ! curl -s --max-time 5 https://www.google.com >/dev/null && \
       ! curl -s --max-time 5 https://www.baidu.com >/dev/null; then
        print_error "无法连接到互联网，请检查网络连接"
        exit 1
    fi
    print_success "网络连接正常"
}

# 检查操作系统支持
check_os_support() {
    if [ "$PKG_MANAGER" = "unknown" ]; then
        print_error "不支持的 Linux 发行版"
        print_error "请手动安装以下依赖: Python3, pip3, Node.js, npm, python3-venv"
        exit 1
    fi
    print_success "检测到包管理器: $PKG_MANAGER"
}

# 获取安装命令
get_install_cmd() {
    local pkg=$1
    case $PKG_MANAGER in
        apt)
            echo "sudo apt-get update && sudo apt-get install -y $pkg"
            ;;
        yum)
            echo "sudo yum install -y $pkg"
            ;;
        dnf)
            echo "sudo dnf install -y $pkg"
            ;;
        pacman)
            echo "sudo pacman -Sy --noconfirm $pkg"
            ;;
    esac
}

# 安装 Node.js
install_nodejs() {
    case $PKG_MANAGER in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        yum|dnf)
            curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
            sudo $PKG_MANAGER install -y nodejs
            ;;
        pacman)
            sudo pacman -Sy --noconfirm nodejs npm
            ;;
    esac
}

# 检查并安装命令
 check_and_install_command() {
    local cmd=$1
    local pkg=$2

    if ! command -v "$cmd" &>/dev/null; then
        print_warning "未找到 $cmd"
        read -rp "是否自动安装 $pkg? [Y/n]: " choice
        choice=${choice:-Y}
        if [[ "$choice" =~ ^[Yy]$ ]]; then
            print_step "安装" "正在安装 $pkg..."
            eval "$(get_install_cmd "$pkg")"
            print_success "$pkg 安装完成"
        else
            print_error "需要 $pkg 但未安装"
            exit 1
        fi
    fi
}

# 检查 Python 模块
 check_python_module() {
    local module=$1
    local pkg=$2

    if ! python3 -c "import $module" &>/dev/null; then
        print_warning "未找到 $module 模块"
        read -rp "是否自动安装 $pkg? [Y/n]: " choice
        choice=${choice:-Y}
        if [[ "$choice" =~ ^[Yy]$ ]]; then
            print_step "安装" "正在安装 $pkg..."
            eval "$(get_install_cmd "$pkg")"
            print_success "$pkg 安装完成"
        else
            print_error "需要 $pkg 但未安装"
            exit 1
        fi
    fi
}

# 主程序
main() {
    print_header "写作助手项目依赖安装脚本"

    # 检查网络和操作系统
    print_step "0/6" "检查环境..."
    check_network
    check_os_support

    # 检查并安装必要命令
    print_step "1/6" "检查必要命令..."
    check_and_install_command "python3" "python3"
    check_and_install_command "pip3" "python3-pip"

    # 检查 Node.js 和 npm
    if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
        print_warning "未找到 Node.js 或 npm"
        read -rp "是否自动安装 Node.js 和 npm? [Y/n]: " choice
        choice=${choice:-Y}
        if [[ "$choice" =~ ^[Yy]$ ]]; then
            print_step "安装" "正在安装 Node.js 和 npm (LTS 22.x)..."
            install_nodejs
            print_success "Node.js 和 npm 安装完成"
        else
            print_error "需要 Node.js 和 npm 但未安装"
            exit 1
        fi
    fi

    # 检查 python3-venv
    check_python_module "venv" "python3-venv"

    # 后端依赖安装
    echo ""
    print_step "2/6" "设置 Python 虚拟环境并安装后端依赖..."

    if [ ! -d "$BACKEND_DIR" ]; then
        print_error "未找到 backend 目录: $BACKEND_DIR"
        exit 1
    fi

    # 创建虚拟环境（如果不存在）
    if [ ! -d "$BACKEND_DIR/venv" ]; then
        print_step "虚拟环境" "创建虚拟环境 venv..."
        python3 -m venv "$BACKEND_DIR/venv"
        print_success "虚拟环境创建完成"
    else
        print_success "虚拟环境已存在"
    fi

    # 安装后端依赖
    print_step "依赖" "安装后端依赖到虚拟环境..."
    "$BACKEND_DIR/venv/bin/pip" install --upgrade pip
    "$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
    "$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements-dev.txt"
    print_success "后端依赖安装完成"

    # 创建数据库目录
    mkdir -p "$BACKEND_DIR/data"
    print_success "数据库目录已准备"

    # 前端依赖安装
    echo ""
    print_step "3/6" "安装前端 Node.js 依赖..."

    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "未找到 frontend 目录: $FRONTEND_DIR"
        exit 1
    fi

    if [ ! -f "$FRONTEND_DIR/package.json" ]; then
        print_error "未找到 package.json: $FRONTEND_DIR/package.json"
        exit 1
    fi

    (cd "$FRONTEND_DIR" && npm install)
    print_success "前端依赖安装完成"

    # 数据库迁移
    echo ""
    print_step "4/6" "初始化数据库..."
    (cd "$BACKEND_DIR" && "$BACKEND_DIR/venv/bin/alembic" upgrade head)
    print_success "数据库初始化完成"

    # 验证安装
    echo ""
    print_step "5/6" "验证安装..."

    # 检查后端关键依赖
    if ! "$BACKEND_DIR/venv/bin/python" -c "import fastapi" 2>/dev/null; then
        print_warning "FastAPI 可能未正确安装"
    fi

    # 检查前端
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        print_warning "前端 node_modules 可能未正确安装"
    fi

    print_success "安装验证完成"

    # 完成提示
    echo ""
    print_header "所有依赖安装完成！"

    echo "下一步："
    echo ""
    echo "  1. 启动后端服务器："
    echo -e "     ${YELLOW}cd $BACKEND_DIR && ./venv/bin/uvicorn app.main:app --reload${NC}"
    echo ""
    echo "  2. 新开终端，进入前端目录启动前端："
    echo -e "     ${YELLOW}cd $FRONTEND_DIR && npm run dev${NC}"
    echo ""
    echo "访问地址："
    echo "  - 前端: http://localhost:5173"
    echo "  - 后端API文档: http://localhost:8000/docs"
}

main "$@"
