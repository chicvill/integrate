import sqlite3

conn = sqlite3.connect('integrat.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", [r[0] for r in c.fetchall()])

c.execute("SELECT room_number, name, rent, maintenance, deposit, lease_type, pay_timing FROM rent_rooms WHERE branch_id = 'main' ORDER BY room_number")
for r in c.fetchall():
    print(r)
