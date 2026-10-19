#!/bin/bash
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Gateway Container: $CID"

mkdir -p /tmp/rent_patch
tar -xzf ~/rent_patch.tar.gz -C /tmp/rent_patch
sudo docker cp /tmp/rent_patch/. "$CID:/app/apps/rent/"

sudo docker exec "$CID" python -c "
import sqlite3
for p in ['/app/integrat.db', '/media/integrat.db', '/app/data/rent.db']:
    try:
        conn = sqlite3.connect(p)
        c = conn.cursor()
        c.execute('''UPDATE rent_payments SET tenant_name='공실', note='공실', rent_amount=0, maintenance_amount=0, paid=0 WHERE branch_id='main' AND room_number=101 AND year=2025 AND month=5''')
        c.execute('''UPDATE rent_payments SET tenant_name='공실', note='공실', rent_amount=0, maintenance_amount=0, paid=0 WHERE branch_id='main' AND room_number=701 AND year=2025''')
        conn.commit()
        conn.close()
        print('Updated', p)
    except Exception as e:
        print('Skip', p, e)
"

sudo docker restart "$CID"
echo "DEPLOY_SUCCESS"
