# scripts/sync_portal.ps1
# MQnet Portal & Gateway Hot Sync to GCP VM
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

$TarFile = "$ProjectRoot\gateway_patch.tar.gz"
tar -czf $TarFile -C $ProjectRoot gateway/portal.html gateway/main.py shared/tenant/registry.py

gcloud compute scp $TarFile "integrated:gateway_patch.tar.gz" --zone=us-central1-a

$RemoteScript = @'
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Container: $CID"

mkdir -p /tmp/gw_patch
tar -xzf gateway_patch.tar.gz -C /tmp/gw_patch
sudo docker cp /tmp/gw_patch/gateway/portal.html ${CID}:/app/gateway/portal.html
sudo docker cp /tmp/gw_patch/gateway/main.py ${CID}:/app/gateway/main.py
sudo docker cp /tmp/gw_patch/shared/tenant/registry.py ${CID}:/app/shared/tenant/registry.py
rm -rf /tmp/gw_patch gateway_patch.tar.gz

sudo docker exec ${CID} touch /app/gateway/main.py
echo "Successfully updated portal.html and gateway files in container ${CID}!"
'@

$ScriptFile = "$ProjectRoot\deploy_gw.sh"
[System.IO.File]::WriteAllText($ScriptFile, $RemoteScript, [System.Text.Encoding]::ASCII)

gcloud compute scp $ScriptFile "integrated:deploy_gw.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash deploy_gw.sh; rm deploy_gw.sh"

Remove-Item $ScriptFile -Force
if (Test-Path $TarFile) {
    Remove-Item $TarFile -Force
}
Write-Host "Portal hot-sync complete!" -ForegroundColor Green
