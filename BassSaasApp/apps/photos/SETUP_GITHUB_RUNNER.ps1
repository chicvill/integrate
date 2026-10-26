Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "======================================================="
Write-Host " [MQnet Photos GitHub Actions Runner Auto-Setup]"
Write-Host "======================================================="
Write-Host ""

$RunnerDir = "C:\actions-runner-photos"
if (-not (Test-Path "$RunnerDir\config.cmd")) {
    Write-Host "[Error] Runner directory $RunnerDir does not exist." -ForegroundColor Red
    exit 1
}

# Check if already configured
if (Test-Path "$RunnerDir\.runner") {
    Write-Host "[Info] Runner is already configured! Launching runner..." -ForegroundColor Green
} else {
    Write-Host "1. Opening GitHub Runner token page in your browser..." -ForegroundColor Yellow
    Start-Process "https://github.com/chicvill/photos/settings/actions/runners/new"
    Write-Host ""
    
    $Token = Read-Host "2. Please paste the Runner Token from GitHub page"
    if ([string]::IsNullOrWhiteSpace($Token)) {
        Write-Host "[Error] Token cannot be empty." -ForegroundColor Red
        exit 1
    }

    Write-Host "3. Configuring GitHub Actions Runner..." -ForegroundColor Yellow
    Set-Location $RunnerDir
    cmd.exe /c "config.cmd --url https://github.com/chicvill/photos --token $Token --name MQnet-Photos-Runner --unattended --replace"
}

# Create Startup shortcut
$StartupDir = [System.Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDir "Actions_Runner_Photos.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "$RunnerDir\run.cmd"
$Shortcut.WorkingDirectory = $RunnerDir
$Shortcut.WindowStyle = 7
$Shortcut.Save()
Write-Host "[Success] Added Actions_Runner_Photos.lnk to Windows Startup!" -ForegroundColor Green

# Start runner in new window
Write-Host "4. Starting Actions Runner..." -ForegroundColor Green
Start-Process "cmd.exe" -ArgumentList "/k title Actions_Runner_Photos && cd /d C:\actions-runner-photos && run.cmd"

Write-Host ""
Write-Host "======================================================="
Write-Host " [COMPLETE] Photos GitHub Actions Runner is Active!"
Write-Host "======================================================="
