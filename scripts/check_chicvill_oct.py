import sqlite3

conn = sqlite3.connect('integrat.db')
c = conn.cursor()

c.execute("SELECT room_number, month, paid, paid_date, rent_amount, maintenance_amount, note FROM rent_payments WHERE branch_id = 'main' AND year = 2026 AND month = 10 ORDER BY room_number")
rows = c.fetchall()
print(f"October 2026 rows (total {len(rows)}):")
for r in rows:
    print(r)
