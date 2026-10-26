# Deploy Grammar Quest TV to Google Cloud Run (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  Deploying Grammar Quest TV to Google Cloud Run" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Google Cloud SDK (gcloud) is not found in PATH." -ForegroundColor Red
    Write-Host "Please install Google Cloud SDK from https://cloud.google.com/sdk/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Checking active GCP account and project..." -ForegroundColor Yellow
gcloud config get-value account
gcloud config get-value project
Write-Host ""

$Region = "asia-northeast3"
$ServiceName = "grammer-tv"

Write-Host "Deploying service [$ServiceName] to region [$Region]..." -ForegroundColor Green
Write-Host "Google Cloud Build will remotely build the container image and deploy." -ForegroundColor Gray
Write-Host ""

gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --port 3000

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "===================================================================" -ForegroundColor Green
    Write-Host " [SUCCESS] Successfully deployed to Google Cloud Run!" -ForegroundColor Green
    Write-Host " You can access your TV Game using the Service URL displayed above." -ForegroundColor Green
    Write-Host "===================================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ERROR] Deployment failed. Please review the error message above." -ForegroundColor Red
}
