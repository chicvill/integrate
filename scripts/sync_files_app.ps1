# scripts/sync_files_app.ps1
# MQnet Files Hub - Google Cloud VM 핫 싱크 스크립트
# 사용법: .\scripts\sync_files_app.ps1
# 실행 조건: gcloud CLI 인증 완료 상태

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  MQnet Files Hub - Hot Sync to GCP VM" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. 변경사항 압축 (pycache, pyc 제외) ─────────────────
Write-Host "[1/4] 변경사항 압축 중..." -ForegroundColor Yellow
$TarFile = "$ProjectRoot\files_update.tar.gz"

tar -czf $TarFile `
    --exclude='apps/files/backend/__pycache__' `
    --exclude='apps/files/backend/routers/__pycache__' `
    --exclude='apps/files/backend/services/__pycache__' `
    --exclude='**/*.pyc' `
    -C $ProjectRoot `
    apps/files `
    gateway/main.py

Write-Host "  [OK] 압축 완료: $TarFile" -ForegroundColor Green

# ── 2. 서버로 전송 ────────────────────────────────────────
Write-Host "[2/4] GCP 서버로 전송 중..." -ForegroundColor Yellow
gcloud compute scp $TarFile "instance-1:~/workstation/files_update.tar.gz" --zone=us-central1-a
Write-Host "  [OK] 전송 완료" -ForegroundColor Green

# ── 3. 서버에서 풀기 및 Uvicorn 리로드 트리거 ────────────
Write-Host "[3/4] 서버에서 풀기 및 리로드 트리거..." -ForegroundColor Yellow
gcloud compute ssh instance-1 --zone=us-central1-a --command @"
  set -e
  tar -xzf ~/workstation/files_update.tar.gz -C ~/workstation/
  rm ~/workstation/files_update.tar.gz
  touch ~/workstation/gateway/main.py
  echo '[OK] 풀기 완료 및 Uvicorn 리로드 트리거'
"@
Write-Host "  [OK] 서버 동기화 완료" -ForegroundColor Green

# ── 4. 로컬 임시 파일 정리 ───────────────────────────────
Write-Host "[4/4] 로컬 임시 파일 정리..." -ForegroundColor Yellow
Remove-Item $TarFile -Force
Write-Host "  [OK] 정리 완료" -ForegroundColor Green

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  배포 완료! http://34.31.10.12:9000/files/" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
