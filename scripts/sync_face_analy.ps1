# scripts/sync_face_analy.ps1
# MQnet face_analy - GCP 실서버 즉시 동기화 스크립트

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TarFile = "$ProjectRoot\face_analy_sync.tar.gz"

Write-Host "1. Compressing dist and backend..." -ForegroundColor Yellow
tar -czf $TarFile -C "$ProjectRoot\apps\face_analy" dist backend

Write-Host "2. Uploading to GCP VM..." -ForegroundColor Yellow
gcloud compute scp $TarFile "integrated:face_analy_sync.tar.gz" --zone=us-central1-a

Write-Host "3. Extracting inside Gateway container and restarting..." -ForegroundColor Yellow
$remoteCmd = @'
CID=$(sudo docker ps -qf name=gateway | head -n 1)
echo "Container ID: $CID"
sudo docker cp ~/face_analy_sync.tar.gz ${CID}:/app/face_analy_sync.tar.gz
sudo docker exec ${CID} bash -c "cd /app/apps/face_analy && tar -xzf /app/face_analy_sync.tar.gz && rm -f /app/face_analy_sync.tar.gz"
sudo docker restart ${CID}
echo "Gateway Container Restarted!"
'@

$remoteScript = "$ProjectRoot\deploy_face_remote.sh"
[System.IO.File]::WriteAllText($remoteScript, $remoteCmd, [System.Text.Encoding]::ASCII)
gcloud compute scp $remoteScript "integrated:~/deploy_face_remote.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash ~/deploy_face_remote.sh"

if (Test-Path $TarFile) {
    Remove-Item $TarFile -Force
}
if (Test-Path $remoteScript) {
    Remove-Item $remoteScript -Force
}

Write-Host "Sync Complete! Check http://34.31.10.12/face_analy/" -ForegroundColor Green
