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
& "C:\Users\USER\AppData\Local\Programs\Python\Python314\python.exe" "$ProjectRoot\scripts\build_rent_bundle.py"
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

# DB 컬럼 및 건물명 마이그레이션 (integrat.db)
sudo docker exec "$CID" python -c "
import sqlite3
conn = sqlite3.connect('/app/integrat.db')
c = conn.cursor()
cols = [r[1] for r in c.execute('PRAGMA table_info(rent_expenses)').fetchall()]
if 'receipt_type' not in cols:
    c.execute('ALTER TABLE rent_expenses ADD COLUMN receipt_type VARCHAR(50) DEFAULT \"\"')
if 'receipt_info' not in cols:
    c.execute('ALTER TABLE rent_expenses ADD COLUMN receipt_info TEXT DEFAULT \"\"')
try:
    c.execute(\"UPDATE rent_branches SET name = '시크빌 (29개실)' WHERE branch_id = 'main'\")
except Exception as e:
    pass
conn.commit()
print('DB Migration Completed!')
"

sudo docker exec "$CID" touch /app/gateway/main.py
echo "Successfully hot-synced rent app to container $CID!"
'@

# Execute via gcloud compute ssh
$ScriptFile = "$ProjectRoot\scratch_deploy_rent.sh"
[System.IO.File]::WriteAllText($ScriptFile, $RemoteCommand, [System.Text.Encoding]::ASCII)
gcloud compute scp $ScriptFile "integrated:deploy_rent.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash deploy_rent.sh; rm deploy_rent.sh"
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
