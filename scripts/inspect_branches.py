import sqlite3
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else '/media/integrat.db'
conn = sqlite3.connect(db_path)
branches = conn.execute("SELECT branch_id, name FROM rent_branches").fetchall()
print(f"Branches in {db_path}:")
for b in branches:
    room_count = conn.execute("SELECT COUNT(*) FROM rent_rooms WHERE branch_id=?", (b[0],)).fetchone()[0]
    payment_count = conn.execute("SELECT COUNT(*) FROM rent_payments WHERE branch_id=?", (b[0],)).fetchone()[0]
    print(f"  branch_id={b[0]}, name={b[1]}, rooms={room_count}, payments={payment_count}")
