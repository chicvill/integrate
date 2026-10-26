# SelfStudy Auto-Start Setup Script (Windows Startup Folder)
$ErrorActionPreference = "Stop"

$StartupFolder = [System.Environment]::GetFolderPath('Startup')
# 1. SelfStudy Production Shortcut
$ShortcutPath1 = Join-Path $StartupFolder "SelfStudy_Production.lnk"
$TargetPath1 = "d:\Workstation\selfstudy\RUN_PROD.BAT"
$WorkingDir1 = "d:\Workstation\selfstudy"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut1 = $WshShell.CreateShortcut($ShortcutPath1)
$Shortcut1.TargetPath = $TargetPath1
$Shortcut1.WorkingDirectory = $WorkingDir1
$Shortcut1.WindowStyle = 7 # Minimized
$Shortcut1.Save()

Write-Host "[OK] SelfStudy auto-start shortcut created successfully at:"
Write-Host "     $ShortcutPath1"

# 2. Actions Runner Shortcut
$ShortcutPath2 = Join-Path $StartupFolder "Actions_Runner.lnk"
$TargetPath2 = "C:\actions-runner\run.cmd"
$WorkingDir2 = "C:\actions-runner"

$Shortcut2 = $WshShell.CreateShortcut($ShortcutPath2)
$Shortcut2.TargetPath = $TargetPath2
$Shortcut2.WorkingDirectory = $WorkingDir2
$Shortcut2.WindowStyle = 7 # Minimized
$Shortcut2.Save()

Write-Host "[OK] Actions Runner auto-start shortcut created successfully at:"
Write-Host "     $ShortcutPath2"

