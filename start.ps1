# LocalScribe Project Startup Script (Windows)
# Usage: Run .\start.ps1 in PowerShell

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

# Save original directory at script start
$script:OriginalDir = Get-Location

# ========================================
# Check Execution Policy
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
# Color Output Functions
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
function Write-Error { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Gray }

# ========================================
# Get Project Root Directory
# ========================================
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvDir = Join-Path $BackendDir "venv"
$DataDir = Join-Path $BackendDir "data"
$UploadsDir = Join-Path $BackendDir "uploads"

# Python executable path (venv or global)
$PythonExe = if ($UseGlobalPython -or -not (Test-Path $VenvDir)) { "python" } else { Join-Path $VenvDir "Scripts\python.exe" }

# ========================================
# Error Handling and Cleanup
# ========================================
$script:Processes = @()

function Register-Process {
    param($Process)
    $script:Processes += $Process
}

function Stop-ProcessTree {
    param([int]$ParentProcessId)
    try {
        # Get child processes
        $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ParentProcessId }
        foreach ($child in $children) {
            Stop-ProcessTree -ParentProcessId $child.ProcessId
        }
        # Stop the parent process
        Stop-Process -Id $ParentProcessId -Force -ErrorAction SilentlyContinue
    } catch {
        # Process may already be gone
    }
}

function Cleanup {
    try {
        Write-Host ""
        Write-Warning "Cleaning up..."
        foreach ($proc in $script:Processes) {
            if ($proc -and -not $proc.HasExited) {
                try {
                    # Stop process tree to ensure child processes are also terminated
                    Stop-ProcessTree -ParentProcessId $proc.Id
                    Write-Info "Stopped process PID $($proc.Id)"
                } catch {
                    # Process may already be gone
                }
            }
        }
        # Also clean up any remaining processes on our ports (use actual ports if available)
        if (-not $FrontendOnly -and $script:ActualBackendPort) {
            Stop-ProcessOnPort -Port $script:ActualBackendPort -Confirm:$false
        }
        if (-not $BackendOnly -and $script:ActualFrontendPort) {
            Stop-ProcessOnPort -Port $script:ActualFrontendPort -Confirm:$false
        }
        Write-Success "Cleanup completed"
    } catch {
        # Ignore cleanup errors
    }
    # Always restore original directory
    if ($script:OriginalDir) {
        Set-Location $script:OriginalDir -ErrorAction SilentlyContinue
    }
}

Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }

# ========================================
# Check Node.js Version (>= 22.x)
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
# Install Node.js (using fnm)
# ========================================
function Install-NodeJS {
    Write-Step "Node.js" "Node.js 22.x required..."

    # Detect if in China
    $isCN = $false
    try {
        $null = Invoke-WebRequest -Uri "https://www.google.com" -TimeoutSec 3 -ErrorAction Stop
    } catch {
        $isCN = $true
        Write-Info "China network detected, using mirror..."
    }

    # Check if fnm is installed
    $fnmInstalled = $null -ne (Get-Command fnm -ErrorAction SilentlyContinue)

    if (-not $fnmInstalled) {
        Write-Step "Node.js" "Installing fnm (Fast Node Manager)..."

        try {
            if ($isCN) {
                $env:FNM_NODE_DIST_MIRROR = "https://npmmirror.com/mirrors/node"
            }
            winget install Schniz.fnm
            Write-Success "fnm installed, please restart terminal and run script again"
            exit 1
        } catch {
            Write-Error "fnm installation failed, please install Node.js 22.x manually"
            Write-Info "Download: https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi"
            exit 1
        }
    }

    # Install Node.js 22 using fnm
    Write-Step "Node.js" "Installing Node.js 22.x using fnm..."
    if ($isCN) {
        $env:FNM_NODE_DIST_MIRROR = "https://npmmirror.com/mirrors/node"
    }
    fnm install 22
    fnm use 22
    fnm default 22

    # Reload environment variables via fnm
    $fnmEnv = fnm env --power-shell | Out-String
    if ($fnmEnv) {
        Invoke-Expression $fnmEnv
    }

    # Also update PATH directly as fallback
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")

    if (Test-NodeVersion) {
        Write-Success "Node.js $(node --version) installed"
    } else {
        Write-Error "Node.js version verification failed"
        exit 1
    }
}

# ========================================
# Show Migration Repair Menu
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
# Check and Fix Database Migrations
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

        # Get current migration version (using cmd to avoid PowerShell error handling)
        $currentRevOutput = cmd /c "$PythonExe -m alembic current 2>&1" | Out-String
        # Match 12-character hex revision ID (alembic revision format)
        $currentRev = $currentRevOutput | Select-String -Pattern "[a-f0-9]{12}" | Select-Object -First 1
        $currentRev = if ($currentRev) { $currentRev.Matches[0].Value } else { "none" }

        # Get latest migration version
        $headRevOutput = cmd /c "$PythonExe -m alembic heads 2>&1" | Out-String
        # Match 12-character hex revision ID
        $headRev = $headRevOutput | Select-String -Pattern "[a-f0-9]{12}" | Select-Object -First 1
        $headRev = if ($headRev) { $headRev.Matches[0].Value } else { "none" }

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
                    Write-Error "Invalid option"
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

    # Create data directory
    if (-not (Test-Path $DataDir)) {
        New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    }

    return $needsReset
}

# ========================================
# Find Available Port
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
# Stop Process on Port
# ========================================
function Stop-ProcessOnPort {
    param(
        [int]$Port,
        [switch]$Confirm = $true
    )
    $connections = netstat -ano | Select-String ":$Port\s+.*LISTENING"
    foreach ($conn in $connections) {
        if ($conn -match "\s+(\d+)\s*$") {
            $processId = $Matches[1]
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            $procName = if ($proc) { $proc.ProcessName } else { "unknown" }

            if ($Confirm -and -not $NonInteractive) {
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
}

# ========================================
# Wait for Service to be Ready
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
# Main Program
# ========================================
function Main {
    Write-Header "LocalScribe Project Startup Script"

    # ========================================
    # 1. Check Environment
    # ========================================
    Write-Step "1/6" "Checking environment..."

    # Check Python
    try {
        $PythonVersion = python --version 2>&1
        if ($PythonVersion -match "Python 3\.(\d+)") {
            $MinorVersion = [int]$Matches[1]
            if ($MinorVersion -lt 10) {
                Write-Error "Python 3.10+ required, current: $PythonVersion"
                exit 1
            }
            Write-Success "Python version: $PythonVersion"
        }
    } catch {
        Write-Error "Python not found, please install Python 3.10+"
        exit 1
    }

    # Check Node.js
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
                    Write-Error "Node.js 22.x required but not installed"
                    exit 1
                }
            }
        } else {
            Write-Success "Node.js version satisfied: $(node --version)"
        }
    }

    # ========================================
    # 2. Backend Dependencies
    # ========================================
    if (-not $FrontendOnly) {
        Write-Host ""
        Write-Step "2/6" "Setting up Python virtual environment and installing backend dependencies..."

        if (-not (Test-Path $BackendDir)) {
            Write-Error "Backend directory not found: $BackendDir"
            exit 1
        }

        Set-Location $BackendDir

        # Create virtual environment if not exists and not using global Python
        if (-not $UseGlobalPython -and -not (Test-Path $VenvDir)) {
            Write-Step "Venv" "Creating virtual environment..."
            python -m venv $VenvDir
            Write-Success "Virtual environment created"
        } elseif ($UseGlobalPython) {
            Write-Info "Using global Python environment"
        } else {
            Write-Success "Virtual environment already exists"
        }

        # Install backend dependencies
        Write-Step "Deps" "Installing backend dependencies..."
        & $PythonExe -m pip install --upgrade pip
        & $PythonExe -m pip install -r (Join-Path $BackendDir "requirements.txt")
        & $PythonExe -m pip install -r (Join-Path $BackendDir "requirements-dev.txt")
        Write-Success "Backend dependencies installed"

        # Verify alembic installation
        Write-Step "Verify" "Checking alembic installation..."
        try {
            $alembicVersion = & $PythonExe -c "import alembic; print(alembic.__version__)" 2>$null
            Write-Success "alembic verified (version: $alembicVersion)"
        } catch {
            Write-Warning "alembic not properly installed, reinstalling..."
            & $PythonExe -m pip install alembic
        }
    }

    # ========================================
    # 3. Check and Fix Database Migrations
    # ========================================
    $needsDbInit = $false
    if (-not $FrontendOnly) {
        Write-Host ""
        Write-Step "3/6" "Checking and fixing database migrations..."
        $needsDbInit = Test-AndFixMigrations
    }

    # Create required directories (even in SetupOnly mode)
    if (-not (Test-Path $DataDir)) {
        New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    }
    if (-not (Test-Path $UploadsDir)) {
        New-Item -ItemType Directory -Path $UploadsDir -Force | Out-Null
    }

    # Exit if setup only
    if ($SetupOnly) {
        Write-Header "Setup Complete!"
        Write-Info "Run the following commands to start services:"
        Write-Host "  Backend: cd backend; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload"
        Write-Host "  Frontend: cd frontend; npm run dev"
        # Restore original directory before exit
        if ($script:OriginalDir) {
            Set-Location $script:OriginalDir
        }
        exit 0
    }

    # ========================================
    # 4. Frontend Dependencies
    # ========================================
    if (-not $BackendOnly) {
        Write-Host ""
        Write-Step "4/6" "Installing frontend Node.js dependencies..."

        if (-not (Test-Path $FrontendDir)) {
            Write-Error "Frontend directory not found: $FrontendDir"
            exit 1
        }

        Set-Location $FrontendDir

        if (-not (Test-Path (Join-Path $FrontendDir "package.json"))) {
            Write-Error "package.json not found"
            exit 1
        }

        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Frontend dependencies installation failed"
            exit 1
        }
        Write-Success "Frontend dependencies installed"
    }

    # ========================================
    # 5. Database Migration
    # ========================================
    if (-not $FrontendOnly) {
        Write-Host ""
        Write-Step "5/6" "Initializing database..."
        Set-Location $BackendDir
        & $PythonExe -m alembic upgrade head
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database initialized"
        } else {
            Write-Error "Database initialization failed"
            exit 1
        }
    }

    # ========================================
    # 6. Verify Installation
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
    # Start Services
    # ========================================
    Write-Header "Starting Services"

    # Start Backend
    if (-not $FrontendOnly) {
        Write-Host "[Backend Service Starting]" -ForegroundColor Magenta

        # Find available port
        Write-Step "Port" "Finding available port..."
        Stop-ProcessOnPort -Port $BackendPort -Confirm:$false
        # Wait for port to be fully released
        $maxWait = 10
        $waited = 0
        while ($waited -lt $maxWait) {
            Start-Sleep -Milliseconds 500
            $waited++
            try {
                $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $BackendPort)
                $listener.Start()
                $listener.Stop()
                break
            } catch {
                if ($listener) { $listener.Stop() }
            }
        }
        $script:ActualBackendPort = Get-AvailablePort -StartPort $BackendPort
        if ($script:ActualBackendPort -ne $BackendPort) {
            Write-Warning "Port $BackendPort occupied, using port $script:ActualBackendPort"
        }

        # Start backend service
        Write-Step "Start" "Starting backend service (port: $script:ActualBackendPort)..."

        $BackendProcess = Start-Process -FilePath $PythonExe -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", $script:ActualBackendPort, "--reload" -WorkingDirectory $BackendDir -PassThru -WindowStyle Hidden
        Register-Process -Process $BackendProcess

        # Wait for backend to start
        Write-Step "Wait" "Waiting for backend service to start..."
        $backendReady = Wait-ForService -Url "http://127.0.0.1:$($script:ActualBackendPort)/health" -Name "Backend" -MaxWaitSeconds 30

        if ($backendReady) {
            Write-Success "Backend service started: http://127.0.0.1:$($script:ActualBackendPort)"
        } else {
            if (-not $BackendProcess.HasExited) {
                Write-Warning "Backend service may still be starting, please check later"
            } else {
                Write-Error "Backend service failed to start (process exited)"
                exit 1
            }
        }
    }

    # Start Frontend
    if (-not $BackendOnly) {
        Write-Host ""
        Write-Host "[Frontend Service Starting]" -ForegroundColor Magenta

        # Find available port
        Write-Step "Port" "Finding available port..."
        Stop-ProcessOnPort -Port $FrontendPort -Confirm:$false
        # Wait for port to be fully released
        $maxWait = 10
        $waited = 0
        while ($waited -lt $maxWait) {
            Start-Sleep -Milliseconds 500
            $waited++
            try {
                $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $FrontendPort)
                $listener.Start()
                $listener.Stop()
                break
            } catch {
                if ($listener) { $listener.Stop() }
            }
        }
        $script:ActualFrontendPort = Get-AvailablePort -StartPort $FrontendPort
        if ($script:ActualFrontendPort -ne $FrontendPort) {
            Write-Warning "Port $FrontendPort occupied, using port $script:ActualFrontendPort"
        }

        # Start frontend service
        Write-Step "Start" "Starting frontend service (port: $script:ActualFrontendPort)..."

        $FrontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm", "run", "dev", "--", "--port", $script:ActualFrontendPort -WorkingDirectory $FrontendDir -PassThru -WindowStyle Hidden
        Register-Process -Process $FrontendProcess

        # Wait for frontend to start
        Write-Step "Wait" "Waiting for frontend service to start..."
        $frontendReady = Wait-ForService -Url "http://localhost:$($script:ActualFrontendPort)" -Name "Frontend" -MaxWaitSeconds 30

        if ($frontendReady) {
            Write-Success "Frontend service started: http://localhost:$($script:ActualFrontendPort)"
        } else {
            if (-not $FrontendProcess.HasExited) {
                Write-Warning "Frontend service may still be starting, please check later"
            } else {
                Write-Error "Frontend service failed to start (process exited)"
                exit 1
            }
        }
    }

    # ========================================
    # Complete
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

    # Keep running
    try {
        while ($true) {
            Start-Sleep -Seconds 1

            if (-not $FrontendOnly -and $BackendProcess.HasExited) {
                Write-Error "Backend service exited"
                break
            }
            if (-not $BackendOnly -and $FrontendProcess.HasExited) {
                Write-Error "Frontend service exited"
                break
            }
        }
    } finally {
        Cleanup
    }
}

# Run main program
Main
