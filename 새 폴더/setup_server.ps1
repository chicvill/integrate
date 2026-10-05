# MQnet integrate - 이 PC를 서버로 설정 (git push 차단, 로컬 전용 파일만 생성)
# 실행: 관리자 PowerShell에서  powershell -ExecutionPolicy Bypass -File setup_server.ps1
$ErrorActionPreference = "Stop"
$Repo = "https://github.com/chicvill/integrate"
$Dir  = "D:\Workstation\integrated"
$Port = 9000

# 0) 관리자 권한 확인 (방화벽/작업 스케줄러 등록용)
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw "관리자 권한으로 실행해 주세요." }

# 1) clone 또는 pull
New-Item -ItemType Directory -Force -Path (Split-Path $Dir) | Out-Null
if (Test-Path "$Dir\.git") {
    Set-Location $Dir
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw "pull 실패: 로컬 변경사항과 충돌했을 수 있습니다. git status 확인 후 다시 실행하세요." }
} else {
    git clone $Repo $Dir
    Set-Location $Dir
}

# 2) git에 올라가지 않도록 보호: push 주소 무효화 + 로컬 생성 파일 제외
git remote set-url --push origin DISABLED_NO_PUSH
$exclude = ".git\info\exclude"
$ignoreList = @(".env.shared", "run_server.bat", ".venv/", "logs/", "setup_server.ps1")
foreach ($line in $ignoreList) {
    if (-not (Select-String -Path $exclude -SimpleMatch -Pattern $line -Quiet -ErrorAction SilentlyContinue)) {
        Add-Content -Path $exclude -Value $line
    }
}

# 3) .env.shared 준비 (없을 때만 템플릿 복사)
if (-not (Test-Path ".env.shared")) {
    Copy-Item ".env.shared.template" ".env.shared"
    Write-Host "[알림] .env.shared 를 열어 실제 키/DB 값을 입력하세요." -ForegroundColor Yellow
}

# 4) 가상환경 + 의존성 설치
if (-not (Test-Path ".venv")) { python -m venv .venv }
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

# 5) 서버 실행 스크립트 생성 (--reload 없음, 로그 기록, 비정상 종료 시 재시작)
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
@"
@echo off
chcp 65001 > nul
cd /d "%~dp0"
set PYTHONPATH=%~dp0
:loop
".venv\Scripts\python.exe" -m uvicorn gateway.main:app --host 0.0.0.0 --port $Port --proxy-headers --forwarded-allow-ips="*" >> logs\server.log 2>&1
timeout /t 5 /nobreak > nul
goto loop
"@ | Set-Content -Path "run_server.bat" -Encoding ASCII

# 6) 방화벽 인바운드 허용 (사설 네트워크만)
if (-not (Get-NetFirewallRule -DisplayName "MQnet Gateway $Port" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "MQnet Gateway $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private | Out-Null
}

# 7) 부팅 시 자동 실행 (작업 스케줄러)
$action  = New-ScheduledTaskAction -Execute "$Dir\run_server.bat"
$trigger = New-ScheduledTaskTrigger -AtStartup
$set     = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName "MQnet-Server" -Action $action -Trigger $trigger -Settings $set -RunLevel Highest -User "SYSTEM" -Force | Out-Null
Start-ScheduledTask -TaskName "MQnet-Server"

Start-Sleep -Seconds 8
try {
    $r = Invoke-WebRequest -UseBasicParsing "http://localhost:$Port/health" -TimeoutSec 10
    Write-Host "[OK] 서버 응답: $($r.StatusCode)  ->  http://<이 PC의 IP>:$Port" -ForegroundColor Green
} catch {
    Write-Host "[확인 필요] 헬스체크 실패. logs\server.log 를 확인하세요." -ForegroundColor Red
}
