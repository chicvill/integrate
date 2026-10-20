import sqlite3

def run():
    conn = sqlite3.connect('integrat.db')
    c = conn.cursor()

    c.execute("SELECT room_number, rent, maintenance, lease_type FROM rent_rooms WHERE branch_id='main'")
    rooms = {r[0]: {'rent': r[1], 'maint': r[2], 'type': r[3]} for r in c.fetchall()}

    c.execute("SELECT id, room_number, month, rent_amount, maintenance_amount FROM rent_payments WHERE branch_id='main' AND year=2025 AND paid=1 AND maintenance_amount=0")
    rows = c.fetchall()
    print(f"Total 2025 rows to update maintenance: {len(rows)}")

    updates = []
    for pid, rnum, month, r_amt, m_amt in rows:
        rm = rooms.get(rnum, {'rent': 290000, 'maint': 150000, 'type': '월세'})
        tot = r_amt + m_amt
        target_maint = rm['maint']
        if rm['type'] == '전세':
            new_r = 0
            new_m = tot
        else:
            new_m = min(target_maint, tot)
            new_r = tot - new_m
        updates.append((new_r, new_m, pid))

    for u in updates[:10]:
        print("Sample update:", u)

    c.executemany("UPDATE rent_payments SET rent_amount=?, maintenance_amount=? WHERE id=?", updates)
    conn.commit()
    print(f"Successfully updated {len(updates)} records in integrat.db for 2025!")

    # Verify summary
    c.execute("SELECT month, sum(rent_amount), sum(maintenance_amount), sum(rent_amount + maintenance_amount) FROM rent_payments WHERE branch_id='main' AND year=2025 AND paid=1 GROUP BY month ORDER BY month")
    print("Updated 2025 monthly totals (rent, maint, sum):")
    for r in c.fetchall():
        print(f"Month {r[0]}: Rent={r[1]:,}, Maint={r[2]:,}, Total={r[3]:,}")

    conn.close()

if __name__ == '__main__':
    run()
