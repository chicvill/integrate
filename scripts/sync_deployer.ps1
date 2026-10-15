# scripts/sync_deployer.ps1
# MQnet Deployer (Distro Studio) & Rent Reset & Gateway Hot Sync to GCP VM (34.31.10.12)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "📦 패키징 아카이브 생성 중..." -ForegroundColor Cyan
$TarFile = "$ProjectRoot\deployer_patch.tar.gz"

# 아카이브 압축
tar -czf $TarFile -C $ProjectRoot `
    gateway/portal.html `
    gateway/main.py `
    shared/tenant/registry.py `
    apps/deployer `
    apps/rent/backend/routers/main_router.py `
    apps/rent/backend/services/branch_service.py

Write-Host "☁️ GCP VM(integrated)으로 전송 중..." -ForegroundColor Cyan
gcloud compute scp $TarFile "integrated:deployer_patch.tar.gz" --zone=us-central1-a

$RemoteScript = @'
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Container: $CID"

mkdir -p /tmp/deployer_patch
tar -xzf deployer_patch.tar.gz -C /tmp/deployer_patch

# 컨테이너로 파일 복사
sudo docker cp /tmp/deployer_patch/gateway/portal.html ${CID}:/app/gateway/portal.html
sudo docker cp /tmp/deployer_patch/gateway/main.py ${CID}:/app/gateway/main.py
sudo docker cp /tmp/deployer_patch/shared/tenant/registry.py ${CID}:/app/shared/tenant/registry.py
sudo docker cp /tmp/deployer_patch/apps/deployer ${CID}:/app/apps/
sudo docker cp /tmp/deployer_patch/apps/rent/backend/routers/main_router.py ${CID}:/app/apps/rent/backend/routers/main_router.py
sudo docker cp /tmp/deployer_patch/apps/rent/backend/services/branch_service.py ${CID}:/app/apps/rent/backend/services/branch_service.py

rm -rf /tmp/deployer_patch deployer_patch.tar.gz

# 게이트웨이 리로드 트리거
sudo docker exec ${CID} touch /app/gateway/main.py
echo "✅ 배포 패키징 센터(Deployer) 및 Rent 리셋 기능 반영 완료!"
'@

$ScriptFile = "$ProjectRoot\deploy_deployer.sh"
[System.IO.File]::WriteAllText($ScriptFile, $RemoteScript, [System.Text.Encoding]::ASCII)

gcloud compute scp $ScriptFile "integrated:deploy_deployer.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash deploy_deployer.sh; rm deploy_deployer.sh"

Remove-Item $ScriptFile -Force
if (Test-Path $TarFile) {
    Remove-Item $TarFile -Force
}
Write-Host "🎉 Deployer 배포 및 게이트웨이 동기화 완료!" -ForegroundColor Green
