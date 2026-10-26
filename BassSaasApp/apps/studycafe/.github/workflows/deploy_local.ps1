Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$ErrorActionPreference = "Continue"

Write-Host "======================================================="
Write-Host " [StudyCafe & SelfStudy Stack Auto-Deploy Process]"
Write-Host "======================================================="

$WorkspaceDir = Resolve-Path "$PSScriptRoot\..\.."
$RootEnv = "$WorkspaceDir\..\.env"

if (Test-Path $RootEnv) {
    Write-Host "Auto-syncing root .env file..."
    Copy-Item -Path $RootEnv -Destination "$WorkspaceDir\.env" -Force
}

Write-Host "Working Directory: $WorkspaceDir"
Write-Host "Rebuilding Docker Stack for StudyCafe (8001) & SelfStudy (8005)..."

Set-Location "$WorkspaceDir"
docker compose up -d --build

Write-Host "======================================================="
Write-Host " [SUCCESS] Joint Docker Stack Rebuild Completed!"
Write-Host "======================================================="
