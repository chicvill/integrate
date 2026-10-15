# scripts/sync_real_db.ps1
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "☁️ 시크빌 실데이터 DB를 임시 파일로 복제 후 중앙 서버로 전송 중..." -ForegroundColor Cyan

$TempDb = "$ProjectRoot\temp_sync_integrat.db"
Copy-Item "$ProjectRoot\data\rent.db" $TempDb -Force

gcloud compute scp $TempDb "integrated:integrat.db" --zone=us-central1-a

$RemoteScript = @'
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Container: $CID"

sudo docker cp integrat.db ${CID}:/app/integrat.db
sudo docker cp integrat.db ${CID}:/app/data/rent.db 2>/dev/null || true
rm -f integrat.db

sudo docker restart ${CID}
echo "✅ 중앙 서버에 시크빌 29개실 공식 실데이터 DB 반영 성공!"
'@

$ScriptFile = "$ProjectRoot\deploy_db.sh"
[System.IO.File]::WriteAllText($ScriptFile, $RemoteScript, [System.Text.Encoding]::ASCII)

gcloud compute scp $ScriptFile "integrated:deploy_db.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash deploy_db.sh; rm deploy_db.sh"

Remove-Item $ScriptFile -Force -ErrorAction SilentlyContinue
Remove-Item $TempDb -Force -ErrorAction SilentlyContinue
Write-Host "🎉 중앙 서버 시크빌 실데이터 완벽 동기화 완료!" -ForegroundColor Green
