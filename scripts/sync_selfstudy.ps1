# scripts/sync_selfstudy.ps1
# MQnet SelfStudy - git push 없이 GCP 실서버(34.31.10.12) 즉시 동기화(핫 싱크) 스크립트
# 사용법: .\scripts\sync_selfstudy.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  MQnet SelfStudy - Hot Sync to GCP VM (Without git push)" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 프론트엔드 파일 압축
Write-Host "[1/3] 로컬 변경 파일 압축 중..." -ForegroundColor Yellow
$TarFile = "$ProjectRoot\selfstudy_patch.tar.gz"

tar -czf $TarFile -C "$ProjectRoot\apps\selfstudy\frontend" app.js index.html style.css js

Write-Host "  [OK] 압축 완료" -ForegroundColor Green

# 2. GCP VM으로 전송
Write-Host "[2/3] GCP 서버(34.31.10.12)로 파일 전송 중..." -ForegroundColor Yellow
gcloud compute scp $TarFile "integrated:selfstudy_patch.tar.gz" --zone=us-central1-a
Write-Host "  [OK] 전송 완료" -ForegroundColor Green

# 3. 도커 컨테이너에 즉시 복사 반영
Write-Host "[3/3] 게이트웨이 컨테이너에 즉시 반영 중..." -ForegroundColor Yellow
gcloud compute ssh integrated --zone=us-central1-a --command "bash ~/deploy_selfstudy.sh"
Write-Host "  [OK] 컨테이너 동기화 완료" -ForegroundColor Green

# 4. 로컬 임시 압축파일 삭제
if (Test-Path $TarFile) {
    Remove-Item $TarFile -Force
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  핫 싱크 완료! 브라우저(Ctrl+F5)로 즉시 확인:" -ForegroundColor Green
Write-Host "  http://34.31.10.12:9000/selfstudy/" -ForegroundColor White
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
