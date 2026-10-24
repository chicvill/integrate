# scripts/deploy_to_google_server.ps1
# Deploy updated apps (rent2, studycafe2, selfstudy2, shared, templates) to Google Server (GCP VM: integrated)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "📦 1. 최신 소스코드 패키징 (gcp_update.tar.gz)..." -ForegroundColor Cyan
$TarFile = "$ProjectRoot\gcp_update.tar.gz"
if (Test-Path $TarFile) {
    Remove-Item $TarFile -Force
}
tar -czf $TarFile -C $ProjectRoot apps/rent apps/rent2 apps/studycafe2 apps/selfstudy2 shared templates/saas-template gateway

Write-Host "☁️ 2. 구글 클라우드 서버(integrated: us-central1-a)로 패치 전송 중..." -ForegroundColor Cyan
gcloud compute scp $TarFile "integrated:gcp_update.tar.gz" --zone=us-central1-a

$RemoteScript = @'
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
if [ -z "$CID" ]; then
    CID=$(sudo docker ps -aq --filter name=gateway | head -n 1)
fi
echo "🎯 대상 게이트웨이 컨테이너: $CID"

# 임시 패치 디렉터리 준비 및 압축 해제
rm -rf /tmp/gcp_patch
mkdir -p /tmp/gcp_patch
tar -xzf gcp_update.tar.gz -C /tmp/gcp_patch

# 컨테이너 내부 데이터 디렉터리 보장
sudo docker exec $CID mkdir -p /app/apps/rent/data /app/apps/rent2/data /app/apps/studycafe2/data /app/apps/selfstudy2/data

# 최신 모듈 컨테이너 내부로 복사
sudo docker cp /tmp/gcp_patch/apps/rent $CID:/app/apps/
sudo docker cp /tmp/gcp_patch/apps/rent2 $CID:/app/apps/
sudo docker cp /tmp/gcp_patch/apps/studycafe2 $CID:/app/apps/
sudo docker cp /tmp/gcp_patch/apps/selfstudy2 $CID:/app/apps/
sudo docker cp /tmp/gcp_patch/shared $CID:/app/
sudo docker cp /tmp/gcp_patch/templates/saas-template $CID:/app/templates/
sudo docker cp /tmp/gcp_patch/gateway $CID:/app/

# 임시 파일 정리
rm -rf /tmp/gcp_patch gcp_update.tar.gz

echo "🔄 컨테이너 재시작 중..."
sudo docker restart $CID
sleep 5

echo "📋 최신 컨테이너 실행 로그:"
sudo docker logs $CID --tail 30

echo "🌐 로컬 헬스체크 검증:"
HTTP_PORTAL=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/ || echo "FAIL")
HTTP_RENT2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/rent2/ || echo "FAIL")
HTTP_RENT_ALIAS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/rent/ || echo "FAIL")
HTTP_API_RENT2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/api/rent2/buildings || echo "FAIL")
HTTP_STUDY2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/studycafe2/ || echo "FAIL")
HTTP_SELF2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/selfstudy2/ || echo "FAIL")

echo "결과 코드 -> 포털: $HTTP_PORTAL | rent2: $HTTP_RENT2 | rent(호환): $HTTP_RENT_ALIAS | api/rent2: $HTTP_API_RENT2 | studycafe2: $HTTP_STUDY2 | selfstudy2: $HTTP_SELF2"
'@

$ScriptFile = "$ProjectRoot\remote_gcp_deploy.sh"
$CleanScript = $RemoteScript.Replace("`r`n", "`n")
[System.IO.File]::WriteAllText($ScriptFile, $CleanScript, [System.Text.Encoding]::ASCII)

Write-Host "🚀 3. 원격 배포 및 헬스체크 실행..." -ForegroundColor Cyan
gcloud compute scp $ScriptFile "integrated:remote_gcp_deploy.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash remote_gcp_deploy.sh; rm -f remote_gcp_deploy.sh"

Remove-Item $ScriptFile -Force -ErrorAction SilentlyContinue
Remove-Item $TarFile -Force -ErrorAction SilentlyContinue

Write-Host "✅ 구글 서버 배포 및 동기화 완료!" -ForegroundColor Green
