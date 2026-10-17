import sqlite3
conn = sqlite3.connect('/app/integrat.db')
c = conn.cursor()
total = c.execute("SELECT COUNT(*) FROM rent_payments").fetchone()[0]
dups = c.execute("SELECT branch_id, room_number, year, month, COUNT(*) FROM rent_payments GROUP BY branch_id, room_number, year, month HAVING COUNT(*) > 1").fetchall()
print(f"Total payments: {total}")
print(f"Duplicate combinations count: {len(dups)}")
for d in dups[:10]:
    print(d)
