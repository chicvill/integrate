#!/bin/bash
CID=$(sudo docker ps -qf "name=gateway" | head -n 1)
echo "=== Active Gateway Container: $CID ==="
sudo docker exec $CID python3 -c "
import sqlite3, glob, os
for p in ['/media/integrat.db', '/app/integrat.db', '/app/apps/rent/backend/rent.db']:
    if os.path.exists(p):
        conn = sqlite3.connect(p)
        br = conn.execute('SELECT branch_id, name FROM rent_branches').fetchall()
        rooms = conn.execute('SELECT COUNT(*) FROM rent_rooms').fetchone()[0]
        pays = conn.execute('SELECT COUNT(*) FROM rent_payments').fetchone()[0]
        paid = conn.execute('SELECT COUNT(*) FROM rent_payments WHERE paid=1').fetchone()[0]
        print(f'{p}: branches={br}, rooms={rooms}, payments={pays}, paid={paid}')
        conn.close()
    else:
        print(f'{p}: NOT FOUND')
"
