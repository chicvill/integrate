# scripts/sync_rent_patch.ps1
# Sync rent backend service, frontend bundle, and integrat.db to GCP VM
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

$TarFile = "$ProjectRoot\rent_patch.tar.gz"
tar -czf $TarFile -C $ProjectRoot `
    apps/rent/backend/services/payment_service.py `
    apps/rent/backend/services/rent_service.py `
    apps/rent/backend/services/vat_service.py `
    apps/rent/backend/routers/main_router.py `
    apps/rent/frontend/bundle.js `
    apps/rent/frontend/index.html `
    apps/rent/frontend/manual.html `
    apps/rent/frontend/js/api.js `
    apps/rent/frontend/js/ui.js `
    apps/rent/frontend/js/modals.js `
    apps/rent/frontend/js/state.js `
    apps/rent/bundle.js `
    apps/rent/index.html `
    apps/rent/manual.html `
    apps/rent/js/api.js `
    apps/rent/js/ui.js `
    apps/rent/js/modals.js `
    apps/rent/js/state.js

Write-Host "Uploading patch archive and integrat.db to GCP VM..." -ForegroundColor Cyan
gcloud compute scp $TarFile "integrated:rent_patch.tar.gz" --zone=us-central1-a
gcloud compute scp "$ProjectRoot\integrat.db" "integrated:integrat.db_upload" --zone=us-central1-a

$RemoteScript = @'
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Container: $CID"

# 1. Update application files
mkdir -p /tmp/rent_patch
tar -xzf rent_patch.tar.gz -C /tmp/rent_patch
sudo docker cp /tmp/rent_patch/apps/rent ${CID}:/app/apps/
rm -rf /tmp/rent_patch rent_patch.tar.gz

# 2. Update DB files
MEDIA_HOST_DIR="/data/coolify/applications/o58s2caega68fkuxpff0pubf/media"
if [ ! -d "$MEDIA_HOST_DIR" ]; then
    MEDIA_HOST_DIR="/media"
fi
if [ -f "$MEDIA_HOST_DIR/integrat.db" ]; then
    sudo cp "$MEDIA_HOST_DIR/integrat.db" "$MEDIA_HOST_DIR/integrat.db.bak_$(date +%Y%m%d_%H%M%S)"
fi
sudo cp integrat.db_upload "$MEDIA_HOST_DIR/integrat.db"
sudo chmod 666 "$MEDIA_HOST_DIR/integrat.db"
sudo docker cp integrat.db_upload "$CID:/media/integrat.db" 2>/dev/null || true
sudo docker cp integrat.db_upload "$CID:/app/integrat.db" 2>/dev/null || true
sudo docker exec "$CID" chmod 666 /media/integrat.db /app/integrat.db 2>/dev/null || true
rm -f integrat.db_upload

echo "Restarting gateway container..."
sudo docker restart ${CID}
echo "Gateway container restarted successfully!"

# 3. Quick verification
sudo docker exec "$CID" python -c "
import sqlite3
for p in ['/media/integrat.db', '/app/integrat.db']:
    try:
        conn = sqlite3.connect(p)
        c = conn.cursor()
        total_p = c.execute('SELECT COUNT(*) FROM rent_payments').fetchone()[0]
        paid_p = c.execute('SELECT COUNT(*) FROM rent_payments WHERE paid=1').fetchone()[0]
        print(f'[{p}] Total rent_payments: {total_p}, Paid: {paid_p}')
    except Exception as e:
        print(f'[{p}] {e}')
"
'@

$ScriptFile = "$ProjectRoot\deploy_rent.sh"
[System.IO.File]::WriteAllText($ScriptFile, $RemoteScript, [System.Text.Encoding]::ASCII)

gcloud compute scp $ScriptFile "integrated:deploy_rent.sh" --zone=us-central1-a
gcloud compute ssh integrated --zone=us-central1-a --command "bash deploy_rent.sh; rm -f deploy_rent.sh"

Remove-Item $ScriptFile -Force
if (Test-Path $TarFile) {
    Remove-Item $TarFile -Force
}
Write-Host "Rent patch and DB sync complete!" -ForegroundColor Green
