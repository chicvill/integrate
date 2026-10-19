# scripts/sync_rent.ps1
# MQnet Rent (시크빌 임대관리) - GCP 실서버(34.31.10.12) 즉시 동기화(핫 싱크) 스크립트
# 사용법: .\scripts\sync_rent.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  MQnet Rent - Hot Sync to GCP VM (34.31.10.12)" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 최신 번들 빌드
Write-Host "[1/4] 프론트엔드 최신 번들 빌드 중..." -ForegroundColor Yellow
$PythonCmd = if (Get-Command "py" -ErrorAction SilentlyContinue) { "py -3.14" } elseif (Test-Path "C:\Python314\python.exe") { "C:\Python314\python.exe" } else { "python" }
if ($PythonCmd -eq "py -3.14") {
    py -3.14 "$ProjectRoot\scripts\build_rent_bundle.py"
} else {
    & $PythonCmd "$ProjectRoot\scripts\build_rent_bundle.py"
}
Write-Host "  [OK] 번들 빌드 완료" -ForegroundColor Green

# 2. 변경 파일 압축 (pycache 제외)
Write-Host "[2/4] 패치 파일 압축 중..." -ForegroundColor Yellow
$TarFile = "$ProjectRoot\rent_patch.tar.gz"

tar -czf $TarFile `
    --exclude='apps/rent/backend/__pycache__' `
    --exclude='apps/rent/backend/**/__pycache__' `
    --exclude='**/*.pyc' `
    -C "$ProjectRoot\apps\rent" .

Write-Host "  [OK] 압축 완료: $TarFile" -ForegroundColor Green

# 3. GCP VM으로 전송
Write-Host "[3/4] GCP 서버(34.31.10.12)로 파일 전송 중..." -ForegroundColor Yellow
gcloud compute scp $TarFile "integrated:rent_patch.tar.gz" --zone=us-central1-a
Write-Host "  [OK] 전송 완료" -ForegroundColor Green

# 4. 도커 컨테이너에 즉시 복사 및 DB 마이그레이션 적용
Write-Host "[4/4] 게이트웨이 컨테이너에 즉시 동기화 중..." -ForegroundColor Yellow
$RemoteCommand = @'
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Gateway Container: $CID"

mkdir -p /tmp/rent_patch
tar -xzf rent_patch.tar.gz -C /tmp/rent_patch
sudo docker cp /tmp/rent_patch/. "$CID:/app/apps/rent/"
rm -rf /tmp/rent_patch rent_patch.tar.gz

# DB 마이그레이션 및 중복 정리 실행
sudo docker exec "$CID" python /app/apps/rent/backend/db_dedup.py
sudo docker exec "$CID" python /app/apps/rent/backend/populate_2025_chicvill.py

sudo docker exec "$CID" touch /app/gateway/main.py
echo "Successfully hot-synced rent app to container $CID!"
'@

# Execute via gcloud compute ssh
$ScriptFile = "$ProjectRoot\scratch_deploy_rent.sh"
$UnixCommand = $RemoteCommand.Replace("`r`n", "`n").Replace("`r", "`n")
[System.IO.File]::WriteAllText($ScriptFile, $UnixCommand, (New-Object System.Text.UTF8Encoding $False))
gcloud compute scp $ScriptFile "integrated:deploy_rent.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "tr -d '\r' < deploy_rent.sh > deploy_rent_clean.sh && bash deploy_rent_clean.sh && rm -f deploy_rent.sh deploy_rent_clean.sh"
Remove-Item $ScriptFile -Force

if (Test-Path $TarFile) {
    Remove-Item $TarFile -Force
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  배포 완료! 브라우저(Ctrl+F5)로 즉시 확인:" -ForegroundColor Green
Write-Host "  http://34.31.10.12/rent/  (또는 http://34.31.10.12:9000/rent/)" -ForegroundColor White
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
