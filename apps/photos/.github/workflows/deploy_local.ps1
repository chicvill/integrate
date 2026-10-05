Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$ErrorActionPreference = "Continue"

Write-Host "======================================================="
Write-Host " [MQnet Photos Microservice Auto-Deploy Process]"
Write-Host "======================================================="

$WorkspaceDir = Resolve-Path "$PSScriptRoot\..\.."
$RootEnv = "$WorkspaceDir\..\.env"

if (Test-Path $RootEnv) {
    Write-Host "Auto-syncing root .env file..."
    Copy-Item -Path $RootEnv -Destination "$WorkspaceDir\.env" -Force
}

Write-Host "Working Directory: $WorkspaceDir"
Write-Host "Rebuilding Docker Stack for Photos (8006)..."

Set-Location "$WorkspaceDir"
docker compose up -d --build

Write-Host "======================================================="
Write-Host " [SUCCESS] Photos Docker Stack Rebuild Completed!"
Write-Host "======================================================="
