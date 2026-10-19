import sqlite3
import json
import os

for db_path in ['integrat.db', 'data/rent.db', 'apps/rent/backend/rent.db', 'apps/rent/data/rent.db']:
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("""
            UPDATE rent_payments
            SET tenant_name = '공실', note = '공실', rent_amount = 0, maintenance_amount = 0, paid = 0
            WHERE branch_id = 'main' AND room_number = 101 AND year = 2025 AND month = 5
        """)
        c.execute("""
            UPDATE rent_payments
            SET tenant_name = '공실', note = '공실', rent_amount = 0, maintenance_amount = 0, paid = 0
            WHERE branch_id = 'main' AND room_number = 701 AND year = 2025
        """)
        conn.commit()
        print(f"Updated {db_path}")
        conn.close()

# Also update seed_data.json and chicvill_backup.json if exists
for json_path in ['apps/rent/backend/seed_data.json', 'data/chicvill_backup.json']:
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        rooms = data.get('data', {}).get('rooms', {}) if 'data' in data else data.get('rooms', {})
        if '101' in rooms and 'payments' in rooms['101']:
            for k in ['2025-5', '2025-05']:
                if k in rooms['101']['payments']:
                    rooms['101']['payments'][k]['tenant_name'] = '공실'
                    rooms['101']['payments'][k]['note'] = '공실'
                    rooms['101']['payments'][k]['rent_amount'] = 0
                    rooms['101']['payments'][k]['maintenance_amount'] = 0
                    rooms['101']['payments'][k]['paid'] = False
        if '701' in rooms and 'payments' in rooms['701']:
            for m in range(1, 13):
                for k in [f'2025-{m}', f'2025-{m:02d}']:
                    if k in rooms['701']['payments']:
                        rooms['701']['payments'][k]['tenant_name'] = '공실'
                        rooms['701']['payments'][k]['note'] = '공실'
                        rooms['701']['payments'][k]['rent_amount'] = 0
                        rooms['701']['payments'][k]['maintenance_amount'] = 0
                        rooms['701']['payments'][k]['paid'] = False
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Updated {json_path}")
