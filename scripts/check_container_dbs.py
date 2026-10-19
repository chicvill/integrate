import sqlite3
import os
import shutil

print("Checking DB files:")
for path in ['/media/integrat.db', '/app/integrat.db', 'integrat.db']:
    if os.path.exists(path):
        conn = sqlite3.connect(path)
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        rooms_9348 = conn.execute("SELECT COUNT(*) FROM rent_rooms WHERE branch_id='branch_9348'").fetchone()[0] if 'rent_rooms' in tables else 0
        paid_10 = conn.execute("SELECT COUNT(*) FROM rent_payments WHERE branch_id='branch_9348' AND month=10 AND paid=1").fetchone()[0] if 'rent_payments' in tables else 0
        print(f"[{path}] size: {os.path.getsize(path)}, rooms_9348: {rooms_9348}, month_10_paid: {paid_10}")
        conn.close()
    else:
        print(f"[{path}] DOES NOT EXIST")
