$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "☁️ 원클릭 인스톨러 및 실데이터 패키지 동기화 중..." -ForegroundColor Cyan

# 1. 패치 파일 아카이브
$TarFile = "$ProjectRoot\hot_install_patch.tar.gz"
tar -czf $TarFile -C $ProjectRoot `
    gateway/main.py `
    shared/core/base_database.py `
    apps/deployer/backend/routers/distro_router.py `
    apps/deployer/backend/services/distro_engine.py `
    apps/rent/backend/services/rent_service.py `
    templates/saas-template `
    dist/rent_standalone.zip `
    dist/studycafe_standalone.zip

gcloud compute scp $TarFile "integrated:hot_install_patch.tar.gz" --zone=us-central1-a

$RemoteScript = @'
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Container: $CID"

mkdir -p /tmp/hot_patch
tar -xzf hot_install_patch.tar.gz -C /tmp/hot_patch

# 컨테이너로 파일 복사
sudo docker cp /tmp/hot_patch/gateway/main.py ${CID}:/app/gateway/main.py
sudo docker cp /tmp/hot_patch/shared/core/base_database.py ${CID}:/app/shared/core/base_database.py
sudo docker cp /tmp/hot_patch/apps/deployer/backend/routers/distro_router.py ${CID}:/app/apps/deployer/backend/routers/distro_router.py
sudo docker cp /tmp/hot_patch/apps/deployer/backend/services/distro_engine.py ${CID}:/app/apps/deployer/backend/services/distro_engine.py
sudo docker cp /tmp/hot_patch/apps/rent/backend/services/rent_service.py ${CID}:/app/apps/rent/backend/services/rent_service.py
sudo docker cp /tmp/hot_patch/templates/saas-template ${CID}:/app/templates/

# dist 디렉토리 생성 및 패키지 주입
sudo docker exec ${CID} mkdir -p /app/dist
sudo docker cp /tmp/hot_patch/dist/rent_standalone.zip ${CID}:/app/dist/rent_standalone.zip
sudo docker cp /tmp/hot_patch/dist/studycafe_standalone.zip ${CID}:/app/dist/studycafe_standalone.zip

rm -rf /tmp/hot_patch hot_install_patch.tar.gz

# 게이트웨이 재시작
sudo docker restart ${CID}
echo "✅ 표준 배포 템플릿 및 인스톨러(/install/{app_id}) 동기화 완료!"
'@

$ScriptFile = "$ProjectRoot\deploy_hot.sh"
[System.IO.File]::WriteAllText($ScriptFile, $RemoteScript, [System.Text.Encoding]::ASCII)

gcloud compute scp $ScriptFile "integrated:deploy_hot.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash deploy_hot.sh; rm deploy_hot.sh"

Remove-Item $ScriptFile -Force -ErrorAction SilentlyContinue
Remove-Item $TarFile -Force -ErrorAction SilentlyContinue
Write-Host "🎉 원클릭 인스톨러 배포 성공!" -ForegroundColor Green
