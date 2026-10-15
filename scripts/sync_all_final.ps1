# scripts/sync_all_final.ps1
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "☁️ 최신 rent_standalone.zip 및 프론트엔드를 중앙 서버로 전송 중..." -ForegroundColor Cyan

# 1. rent_standalone.zip 전송
gcloud compute scp "$ProjectRoot\dist\rent_standalone.zip" "integrated:rent_standalone.zip" --zone=us-central1-a

# 2. rent frontend 패치 아카이브 전송
$TarFile = "$ProjectRoot\rent_fe_patch.tar.gz"
tar -czf $TarFile -C $ProjectRoot apps/rent/frontend apps/rent/bundle.js apps/rent/index.html
gcloud compute scp $TarFile "integrated:rent_fe_patch.tar.gz" --zone=us-central1-a

$RemoteScript = @'
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Container: $CID"

# dist 보관함 갱신
sudo docker exec $CID mkdir -p /app/dist
sudo docker cp rent_standalone.zip ${CID}:/app/dist/rent_standalone.zip
rm -f rent_standalone.zip

# 프론트엔드 갱신
mkdir -p /tmp/fe_patch
tar -xzf rent_fe_patch.tar.gz -C /tmp/fe_patch
sudo docker cp /tmp/fe_patch/apps/rent ${CID}:/app/apps/
rm -rf /tmp/fe_patch rent_fe_patch.tar.gz

sudo docker restart ${CID}
echo "✅ 중앙 서버에 공식 백업 파일 100% 동기화 완료!"
'@

$ScriptFile = "$ProjectRoot\deploy_final.sh"
[System.IO.File]::WriteAllText($ScriptFile, $RemoteScript, [System.Text.Encoding]::ASCII)

gcloud compute scp $ScriptFile "integrated:deploy_final.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash deploy_final.sh; rm deploy_final.sh"

Remove-Item $ScriptFile -Force -ErrorAction SilentlyContinue
Remove-Item $TarFile -Force -ErrorAction SilentlyContinue
Write-Host "🎉 모든 서버에 시크빌 공식 백업 데이터 100% 반영 완료!" -ForegroundColor Green
