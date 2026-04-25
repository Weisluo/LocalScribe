# LocalScribe 项目启动脚本 (Windows)
# 使用方法: 在 PowerShell 中运行 .\start.ps1

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$SetupOnly,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [switch]$UseGlobalPython,
    [switch]$SkipMigrationCheck,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"

# 脚本启动时保存原始目录
$script:OriginalDir = Get-Location

# ========================================
# 检查执行策略
# ========================================
$CurrentPolicy = Get-ExecutionPolicy -Scope Process
if ($CurrentPolicy -eq "Restricted" -or $CurrentPolicy -eq "AllSigned") {
    Write-Host "[INFO] Setting PowerShell execution policy..." -ForegroundColor Cyan
    try {
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
        Write-Host "[SUCCESS] Execution policy set" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Cannot set execution policy. Please run as Administrator or execute:" -ForegroundColor Red
        Write-Host "       Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass" -ForegroundColor Yellow
        exit 1
    }
}

# ========================================
# 颜色输出函数
# ========================================
function Write-Header {
    param($Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "  $Message" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
}
function Write-Step { param($Step, $Message) Write-Host "[$Step] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-ErrorMsg { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Gray }

# ========================================
# 获取项目根目录
# ========================================
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvDir = Join-Path $BackendDir "venv"
$DataDir = Join-Path $BackendDir "data"
$UploadsDir = Join-Path $BackendDir "uploads"

# 查找可用的 Python 解释器
function Find-Python {
    # 1. 首先尝试使用 Get-Command 查找候选命令
    $candidates = @("python", "python3", "py")
    foreach ($cmd in $candidates) {
        $command = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($command) {
            try {
                $version = & $command.Source --version 2>&1
                if ($version -match "Python 3\.(\d+)") {
                    return $command.Source
                }
            } catch {
                continue
            }
        }
    }

    # 2. 检查 Windows 常见 Python 安装路径
    $commonPaths = @(
        # Windows Store Python
        "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe",
        "$env:LOCALAPPDATA\Microsoft\WindowsApps\python3.exe",
        # 常见安装路径 (用户目录)
        "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe",
        # 常见安装路径 (系统目录)
        "C:\Python3*\python.exe",
        "C:\Program Files\Python3*\python.exe",
        "C:\Program Files (x86)\Python3*\python.exe"
    )

    foreach ($path in $commonPaths) {
        if ($path -contains "*") {
            # 处理通配符路径
            $matchedItems = Get-ChildItem -Path $path -ErrorAction SilentlyContinue | 
                Sort-Object FullName -Descending | Select-Object -First 1
            if ($matchedItems) {
                $path = $matchedItems.FullName
            } else {
                continue
            }
        }

        if (Test-Path $path) {
            try {
                $version = & $path --version 2>&1
                if ($version -match "Python 3\.(\d+)") {
                    return $path
                }
            } catch {
                continue
            }
        }
    }

    # 3. 最后尝试原始方式作为后备
    foreach ($cmd in $candidates) {
        try {
            $version = & $cmd --version 2>&1
            if ($version -match "Python 3\.(\d+)") {
                return $cmd
            }
        } catch {
            continue
        }
    }

    return $null
}

# Python 可执行文件路径 (venv 或全局)
$GlobalPython = Find-Python
if (-not $GlobalPython) {
    Write-ErrorMsg "Python not found, please install Python 3.10+"
    exit 1
}
$PythonExe = if ($UseGlobalPython -or -not (Test-Path $VenvDir)) { $GlobalPython } else { Join-Path $VenvDir "Scripts\python.exe" }

# ========================================
# 错误处理和清理
# ========================================
$script:Processes = @()

function Register-Process {
    param($Process)
    $script:Processes += $Process
}

function Stop-ProcessTree {
    param([int]$ParentProcessId)
    try {
        # 获取子进程
        $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ParentProcessId }
        foreach ($child in $children) {
            Stop-ProcessTree -ParentProcessId $child.ProcessId
        }
        # 停止父进程
        Stop-Process -Id $ParentProcessId -Force -ErrorAction SilentlyContinue
    } catch {
        # 进程可能已经结束
    }
}

function Cleanup {
    try {
        Write-Host ""
        Write-Warning "Cleaning up..."
        foreach ($proc in $script:Processes) {
            if ($proc -and -not $proc.HasExited) {
                try {
                    # 停止进程树以确保子进程也被终止
                    Stop-ProcessTree -ParentProcessId $proc.Id
                    Write-Info "Stopped process PID $($proc.Id)"
                } catch {
                    # 进程可能已经结束
                }
            }
        }
        # 清理端口上剩余的进程（使用实际端口）
        if (-not $FrontendOnly -and $script:ActualBackendPort) {
            Stop-ProcessOnPort -Port $script:ActualBackendPort -Force
        }
        if (-not $BackendOnly -and $script:ActualFrontendPort) {
            Stop-ProcessOnPort -Port $script:ActualFrontendPort -Force
        }
        Write-Success "Cleanup completed"
    } catch {
        # 忽略清理错误
    }
    # 始终恢复原始目录
    if ($script:OriginalDir) {
        Set-Location $script:OriginalDir -ErrorAction SilentlyContinue
    }
}

# Ctrl+C 处理 — 确保 finally 块能执行清理
$script:CtrlCPressed = $false
try {
    [Console]::CancelKeyPress = {
        $script:CtrlCPressed = $true
        Write-Host "`n[INFO] Ctrl+C pressed, shutting down..." -ForegroundColor Yellow
    }
} catch {
    # 在某些 PowerShell 宿主中可能不支持，忽略
}

# ========================================
# 检查 Node.js 版本 (>= 22.x)
# ========================================
function Test-NodeVersion {
    try {
        $nodeVersion = (node --version).Trim()
        if ($nodeVersion -match '^v(\d+)\.(\d+)\.(\d+)$') {
            $major = [int]$Matches[1]
            return $major -ge 22
        }
        return $false
    } catch {
        return $false
    }
}

# ========================================
# 安装 Node.js (使用 fnm)
# ========================================
function Install-NodeJS {
    Write-Step "Node.js" "Node.js 22.x required..."

    # 检测是否在中国
    $isCN = $false
    try {
        $null = Invoke-WebRequest -Uri "https://www.google.com" -TimeoutSec 3 -ErrorAction Stop
    } catch {
        $isCN = $true
        Write-Info "China network detected, using mirror..."
    }

    # 检查 fnm 是否已安装
    $fnmInstalled = $null -ne (Get-Command fnm -ErrorAction SilentlyContinue)

    if (-not $fnmInstalled) {
        Write-Step "Node.js" "Installing fnm (Fast Node Manager)..."

        try {
            if ($isCN) {
                $env:FNM_NODE_DIST_MIRROR = "https://npmmirror.com/mirrors/node"
            }
            winget install Schniz.fnm
            Write-Success "fnm installed"

            # 配置 PowerShell 配置文件（下次打开终端自动加载）
            if (-not (Test-Path $profile)) {
                New-Item $profile -Force | Out-Null
            }
            $profileContent = Get-Content $profile -Raw -ErrorAction SilentlyContinue
            $fnmInitLine = 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
            if ($profileContent -notmatch [regex]::Escape($fnmInitLine)) {
                Add-Content $profile $fnmInitLine
                Write-Success "fnm auto-initialization added to PowerShell profile"
            }
        } catch {
            Write-ErrorMsg "fnm installation failed, please install Node.js 22.x manually"
            Write-Info "Download: https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi"
            exit 1
        }
    }

    # 确保 fnm 在当前会话中可用（Windows 默认安装路径）
    $fnmDir = $env:FNM_DIR
    if (-not $fnmDir) {
        $fnmDir = "$env:APPDATA\fnm"
    }
    if (Test-Path $fnmDir) {
        $env:PATH = "$fnmDir;$env:PATH"
        $env:FNM_DIR = $fnmDir
    }

    # 初始化 fnm 环境（让 fnm use/default 在当前会话生效，避免报错）
    $fnmEnv = fnm env --shell powershell 2>&1 | Out-String
    Invoke-Expression $fnmEnv

    # 使用 fnm 安装 Node.js 22
    Write-Step "Node.js" "Installing Node.js 22.x using fnm..."
    if ($isCN) {
        $env:FNM_NODE_DIST_MIRROR = "https://npmmirror.com/mirrors/node"
    }
    fnm install 22
    fnm use 22
    fnm default 22

    if (Test-NodeVersion) {
        Write-Success "Node.js $(node --version) installed"
    } else {
        Write-ErrorMsg "Node.js version verification failed"
        exit 1
    }
}

# ========================================
# 显示迁移修复菜单
# ========================================
function Show-MigrationMenu {
    Write-Host ""
    Write-Warning "Database migration version mismatch"
    Write-Host ""
    Write-Host "Select repair option:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1) Delete database and reinitialize (recommended)"
    Write-Host "     - Delete existing database and rerun all migrations"
    Write-Host "     - For development environment, data will be lost"
    Write-Host ""
    Write-Host "  2) Skip database initialization"
    Write-Host "     - No database operations"
    Write-Host ""

    if ($NonInteractive) {
        Write-Info "Non-interactive mode: auto-selecting option 1 (delete and reinitialize)"
        return "1"
    }

    $choice = Read-Host "Enter option [1-2]"
    return $choice
}

# ========================================
# 检查并修复数据库迁移
# ========================================
function Test-AndFixMigrations {
    Write-Step "Database" "Checking migration status..."

    Set-Location $BackendDir

    $DbFile = Join-Path $DataDir "local_scribe.db"
    $needsReset = $false

    if (Test-Path $DbFile) {
        if ($SkipMigrationCheck) {
            Write-Success "Skipping migration check"
            return $false
        }

        # 临时关闭终止错误处理，避免 alembic 的 stderr 日志触发异常
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            # 获取当前迁移版本（2>&1 将 stderr 合并到 stdout 避免错误记录）
            $currentRevOutput = & $PythonExe -m alembic current 2>&1 | Out-String
            # 匹配 12 字符十六进制修订 ID (alembic 修订格式)
            $currentRev = $currentRevOutput | Select-String -Pattern "[a-f0-9]{12}" | Select-Object -First 1
            $currentRev = if ($currentRev) { $currentRev.Matches[0].Value } else { "none" }

            # 获取最新迁移版本
            $headRevOutput = & $PythonExe -m alembic heads 2>&1 | Out-String
            # 匹配 12 字符十六进制修订 ID
            $headRev = $headRevOutput | Select-String -Pattern "[a-f0-9]{12}" | Select-Object -First 1
            $headRev = if ($headRev) { $headRev.Matches[0].Value } else { "none" }
        } finally {
            $ErrorActionPreference = $prevEAP
        }

        Write-Step "Database" "Current: $currentRev, Latest: $headRev"

        if ($currentRev -ne "none" -and $headRev -ne "none" -and $currentRev -ne $headRev) {
            $choice = Show-MigrationMenu

            switch ($choice) {
                "1" {
                    Write-Step "Database" "Deleting database and reinitializing..."
                    Remove-Item $DbFile -Force
                    Write-Success "Old database deleted"
                    $needsReset = $true
                }
                "2" {
                    Write-Warning "Skipping database initialization"
                    return $false
                }
                default {
                    Write-ErrorMsg "Invalid option"
                    exit 1
                }
            }
        } elseif ($currentRev -eq "none") {
            Write-Success "Database empty, will initialize"
            $needsReset = $true
        } else {
            Write-Success "Database version is up to date"
        }
    } else {
        Write-Success "Database file not found, will create new"
        $needsReset = $true
    }

    # 创建数据目录
    if (-not (Test-Path $DataDir)) {
        New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    }

    return $needsReset
}

# ========================================
# 查找可用端口
# ========================================
function Get-AvailablePort {
    param([int]$StartPort)
    $port = $StartPort
    while ($port -lt 65535) {
        $listener = $null
        try {
            $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
            $listener.Start()
            $listener.Stop()
            return $port
        } catch {
            if ($listener) { $listener.Stop() }
            $port++
        }
    }
    throw "Cannot find available port"
}

# ========================================
# 停止端口上的进程
# ========================================
function Stop-ProcessOnPort {
    param(
        [int]$Port,
        [switch]$Force
    )
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    } catch {
        return
    }
    foreach ($conn in $connections) {
        $processId = $conn.OwningProcess
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        $procName = if ($proc) { $proc.ProcessName } else { "unknown" }

        if (-not $Force -and -not $NonInteractive) {
            $choice = Read-Host "Port $Port is occupied by $procName (PID: $processId). Kill it? [Y/n]"
            if ($choice -ne "" -and $choice -notmatch "^[Yy]$") {
                continue
            }
        }

        Write-Warning "Stopping $procName on port $Port (PID: $processId)"
        
        if ($proc) {
            Stop-ProcessTree -ParentProcessId $processId
        } else {
            $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $processId }
            foreach ($child in $children) {
                Write-Warning "Stopping orphan child process (PID: $($child.ProcessId))"
                Stop-ProcessTree -ParentProcessId $child.ProcessId
            }
        }
    }
}

# ========================================
# 等待服务就绪
# ========================================
function Wait-ForService {
    param(
        [string]$Url,
        [string]$Name,
        [int]$MaxWaitSeconds = 30,
        [int]$IntervalSeconds = 1
    )
    $waited = 0
    while ($waited -lt $MaxWaitSeconds) {
        Start-Sleep -Seconds $IntervalSeconds
        $waited += $IntervalSeconds
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                return $true
            }
        } catch {}
    }
    return $false
}

# ========================================
# 等待端口释放
# ========================================
function Wait-PortReleased {
    param(
        [int]$Port,
        [int]$MaxWait = 10
    )
    $waited = 0
    while ($waited -lt $MaxWait) {
        Start-Sleep -Milliseconds 500
        $waited++
        try {
            $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
            $listener.Start()
            $listener.Stop()
            return
        } catch {
            if ($listener) { $listener.Stop() }
        }
    }
}

# ========================================
# 主程序
# ========================================
function Main {
    Write-Header "LocalScribe Project Startup Script"

    # 验证互斥标志
    if ($BackendOnly -and $FrontendOnly) {
        Write-ErrorMsg "-BackendOnly and -FrontendOnly cannot be used together"
        exit 1
    }

    # ========================================
    # 1. 检查环境
    # ========================================
    Write-Step "1/6" "Checking environment..."

    # 检查 Python
    try {
        $PythonVersion = & $GlobalPython --version 2>&1
        if ($PythonVersion -match "Python 3\.(\d+)") {
            $MinorVersion = [int]$Matches[1]
            if ($MinorVersion -lt 10) {
                Write-ErrorMsg "Python 3.10+ required, current: $PythonVersion"
                exit 1
            }
            Write-Success "Python version: $PythonVersion"
        }
    } catch {
        Write-ErrorMsg "Python not found, please install Python 3.10+"
        exit 1
    }

    # 检查 Node.js
    if (-not $BackendOnly) {
        if (-not (Test-NodeVersion)) {
            if (Get-Command node -ErrorAction SilentlyContinue) {
                $currentVersion = node --version
                Write-Warning "Current Node.js version is $currentVersion, need 22.x or higher"
            } else {
                Write-Warning "Node.js not found"
            }

            if ($NonInteractive) {
                Write-Info "Non-interactive mode: auto-installing Node.js 22.x"
                Install-NodeJS
            } else {
                $choice = Read-Host "Install/upgrade Node.js to 22.x? [Y/n]"
                if ($choice -eq "" -or $choice -match "^[Yy]$") {
                    Install-NodeJS
                } else {
                    Write-ErrorMsg "Node.js 22.x required but not installed"
                    exit 1
                }
            }
        } else {
            Write-Success "Node.js version satisfied: $(node --version)"
        }
    }

    # ========================================
    # 2. 后端依赖
    # ========================================
    if (-not $FrontendOnly) {
        Write-Host ""
        Write-Step "2/6" "Setting up Python virtual environment and installing backend dependencies..."

        if (-not (Test-Path $BackendDir)) {
            Write-ErrorMsg "Backend directory not found: $BackendDir"
            exit 1
        }

        Set-Location $BackendDir

        # 如果不存在虚拟环境且不使用全局 Python，则创建虚拟环境
        if (-not $UseGlobalPython -and -not (Test-Path $VenvDir)) {
            Write-Step "Venv" "Creating virtual environment..."
            & $GlobalPython -m venv $VenvDir
            if ($LASTEXITCODE -ne 0) {
                Write-ErrorMsg "Virtual environment creation failed"
                exit 1
            }
            Write-Success "Virtual environment created"
            # 创建 venv 后更新 PythonExe 指向 venv 内的 Python
            $PythonExe = Join-Path $VenvDir "Scripts\python.exe"
        } elseif ($UseGlobalPython) {
            Write-Info "Using global Python environment"
        } else {
            Write-Success "Virtual environment already exists"
        }

        # 检查依赖是否已安装
        Write-Step "Deps" "Checking backend dependencies..."
        $depsInstalled = $false
        try {
            $null = & $PythonExe -c "import fastapi, sqlalchemy, alembic, uvicorn" 2>$null
            $depsInstalled = $true
        } catch {}

        if (-not $depsInstalled) {
            Write-Step "Deps" "Installing backend dependencies..."
            & $PythonExe -m pip install --upgrade pip
            & $PythonExe -m pip install -r (Join-Path $BackendDir "requirements.txt")
            & $PythonExe -m pip install -r (Join-Path $BackendDir "requirements-dev.txt")
            Write-Success "Backend dependencies installed"
        } else {
            Write-Success "Backend dependencies already installed"
        }

        # 验证 alembic 安装
        Write-Step "Verify" "Checking alembic installation..."
        try {
            $alembicVersion = & $PythonExe -c "import alembic; print(alembic.__version__)" 2>$null
            Write-Success "alembic verified (version: $alembicVersion)"
        } catch {
            Write-Warning "alembic not properly installed, reinstalling..."
            & $PythonExe -m pip install alembic
        }
    }

    # 创建必需的目录（即使在仅设置模式下）
    if (-not (Test-Path $DataDir)) {
        New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    }
    if (-not (Test-Path $UploadsDir)) {
        New-Item -ItemType Directory -Path $UploadsDir -Force | Out-Null
    }

    # 如果是仅设置模式则退出（跳过迁移检查——用户只想安装依赖）
    if ($SetupOnly) {
        Write-Header "Setup Complete!"
        Write-Info "Run the following commands to start services:"
        Write-Host "  Backend: cd backend; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload"
        Write-Host "  Frontend: cd frontend; npm run dev"
        if ($script:OriginalDir) {
            Set-Location $script:OriginalDir
        }
        exit 0
    }

    # ========================================
    # 3. 检查并修复数据库迁移
    # ========================================
    if (-not $FrontendOnly) {
        Write-Host ""
        Write-Step "3/6" "Checking and fixing database migrations..."
        Test-AndFixMigrations | Out-Null
    }

    # ========================================
    # 4. 前端依赖
    # ========================================
    if (-not $BackendOnly) {
        Write-Host ""
        Write-Step "4/6" "Installing frontend Node.js dependencies..."

        if (-not (Test-Path $FrontendDir)) {
            Write-ErrorMsg "Frontend directory not found: $FrontendDir"
            exit 1
        }

        Set-Location $FrontendDir

        if (-not (Test-Path (Join-Path $FrontendDir "package.json"))) {
            Write-ErrorMsg "package.json not found"
            exit 1
        }

        if (Test-Path (Join-Path $FrontendDir "node_modules")) {
            Write-Success "Frontend dependencies already installed"
        } else {
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-ErrorMsg "Frontend dependencies installation failed"
                exit 1
            }
            Write-Success "Frontend dependencies installed"
        }
    }

    # ========================================
    # 5. 数据库迁移
    # ========================================
    if (-not $FrontendOnly) {
        Write-Host ""
        Write-Step "5/6" "Initializing database..."
        Set-Location $BackendDir
        & $PythonExe -m alembic upgrade head
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database initialized"
        } else {
            Write-ErrorMsg "Database initialization failed"
            exit 1
        }
    }

    # ========================================
    # 6. 验证安装
    # ========================================
    Write-Host ""
    Write-Step "6/6" "Verifying installation..."

    if (-not $FrontendOnly) {
        try {
            $null = & $PythonExe -c "import fastapi"
            Write-Success "Backend dependencies verified"
        } catch {
            Write-Warning "FastAPI may not be properly installed"
        }
    }

    if (-not $BackendOnly) {
        if (Test-Path (Join-Path $FrontendDir "node_modules")) {
            Write-Success "Frontend dependencies verified"
        } else {
            Write-Warning "Frontend node_modules may not be properly installed"
        }
    }

    # ========================================
    # 启动服务
    # ========================================
    Write-Header "Starting Services"

    # 启动后端
    if (-not $FrontendOnly) {
        Write-Host "[Backend Service Starting]" -ForegroundColor Magenta

        # 查找可用端口
        Write-Step "Port" "Finding available port..."
        Stop-ProcessOnPort -Port $BackendPort -Force
        Wait-PortReleased -Port $BackendPort
        $script:ActualBackendPort = Get-AvailablePort -StartPort $BackendPort
        if ($script:ActualBackendPort -ne $BackendPort) {
            Write-Warning "Port $BackendPort occupied, using port $script:ActualBackendPort"
        }

        # 启动后端服务
        Write-Step "Start" "Starting backend service (port: $script:ActualBackendPort)..."

        $BackendProcess = Start-Process -FilePath $PythonExe -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", $script:ActualBackendPort, "--reload" -WorkingDirectory $BackendDir -PassThru -WindowStyle Hidden
        Register-Process -Process $BackendProcess

        # 等待后端启动
        Write-Step "Wait" "Waiting for backend service to start..."
        $backendReady = Wait-ForService -Url "http://127.0.0.1:$($script:ActualBackendPort)/health" -Name "Backend" -MaxWaitSeconds 30

        if ($backendReady) {
            Write-Success "Backend service started: http://127.0.0.1:$($script:ActualBackendPort)"
        } else {
            if (-not $BackendProcess.HasExited) {
                Write-Warning "Backend service may still be starting, please check later"
            } else {
                Write-ErrorMsg "Backend service failed to start (process exited)"
                exit 1
            }
        }
    }

    # 启动前端
    if (-not $BackendOnly) {
        Write-Host ""
        Write-Host "[Frontend Service Starting]" -ForegroundColor Magenta

        # 查找可用端口
        Write-Step "Port" "Finding available port..."
        Stop-ProcessOnPort -Port $FrontendPort -Force
        Wait-PortReleased -Port $FrontendPort
        $script:ActualFrontendPort = Get-AvailablePort -StartPort $FrontendPort
        if ($script:ActualFrontendPort -ne $FrontendPort) {
            Write-Warning "Port $FrontendPort occupied, using port $script:ActualFrontendPort"
        }

        # 启动前端服务
        Write-Step "Start" "Starting frontend service (port: $script:ActualFrontendPort)..."

        $FrontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm", "run", "dev", "--", "--port", $script:ActualFrontendPort -WorkingDirectory $FrontendDir -PassThru -WindowStyle Hidden
        Register-Process -Process $FrontendProcess

        # 等待前端启动
        Write-Step "Wait" "Waiting for frontend service to start..."
        $frontendReady = Wait-ForService -Url "http://localhost:$($script:ActualFrontendPort)" -Name "Frontend" -MaxWaitSeconds 30

        if ($frontendReady) {
            Write-Success "Frontend service started: http://localhost:$($script:ActualFrontendPort)"
        } else {
            if (-not $FrontendProcess.HasExited) {
                Write-Warning "Frontend service may still be starting, please check later"
            } else {
                Write-ErrorMsg "Frontend service failed to start (process exited)"
                exit 1
            }
        }
    }

    # ========================================
    # 完成
    # ========================================
    Write-Header "All Services Started!"

    if (-not $FrontendOnly) {
        Write-Host "  Backend: http://127.0.0.1:$($script:ActualBackendPort)" -ForegroundColor Cyan
        Write-Host "  API Docs: http://127.0.0.1:$($script:ActualBackendPort)/docs" -ForegroundColor Cyan
    }
    if (-not $BackendOnly) {
        Write-Host "  Frontend: http://localhost:$($script:ActualFrontendPort)" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Warning "Press Ctrl+C to stop services"
    Write-Host ""

    # 保持运行
    while (-not $script:CtrlCPressed) {
        Start-Sleep -Seconds 1

        if (-not $FrontendOnly -and $BackendProcess.HasExited) {
            Write-ErrorMsg "Backend service exited"
            break
        }
        if (-not $BackendOnly -and $FrontendProcess.HasExited) {
            Write-ErrorMsg "Frontend service exited"
            break
        }
    }
}

# 运行主程序
try {
    Main
} finally {
    Cleanup
}
