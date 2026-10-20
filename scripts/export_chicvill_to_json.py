"""
scripts/export_chicvill_to_json.py
integrat.db의 시크빌(main) 최신 룸/결제 상태를 apps/rent/backend/seed_data.json 및 data/chicvill_backup.json에 반영합니다.
"""
import sqlite3
import os
import json

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_PATH = os.path.join(PROJECT_ROOT, "integrat.db")
SEED_PATH = os.path.join(PROJECT_ROOT, "apps", "rent", "backend", "seed_data.json")
BACKUP_PATH = os.path.join(PROJECT_ROOT, "data", "chicvill_backup.json")

def export_data():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Load rooms
    c.execute("""
        SELECT room_number, name, rent, maintenance, deposit, lease_type, pay_timing, phone, id_number, move_in, expiry, move_out
        FROM rent_rooms WHERE branch_id = 'main' ORDER BY room_number
    """)
    room_rows = c.fetchall()

    # Load payments
    c.execute("""
        SELECT room_number, year, month, paid, paid_date, rent_amount, maintenance_amount, note, tenant_name
        FROM rent_payments WHERE branch_id = 'main' ORDER BY room_number, year, month
    """)
    pay_rows = c.fetchall()

    pays_by_room = {}
    for r in pay_rows:
        rn, yr, mo, paid, pdate, ramt, mamt, note, tname = r
        if rn not in pays_by_room:
            pays_by_room[rn] = {}
        pkey = f"{yr}-{mo}"
        pkey_pad = f"{yr}-{mo:02d}"
        pay_obj = {
            "month": mo,
            "year": yr,
            "paid": bool(paid),
            "paid_date": pdate or "",
            "rent_amount": ramt or 0,
            "maintenance_amount": mamt or 0,
            "note": note or "",
            "tenant_name": tname or ""
        }
        pays_by_room[rn][pkey] = pay_obj
        pays_by_room[rn][pkey_pad] = pay_obj
        if yr == 2026:
            pays_by_room[rn][str(mo)] = pay_obj

    rooms_list = []
    for rm in room_rows:
        rn = rm[0]
        r_dict = {
            "room_number": rn,
            "number": rn,
            "name": rm[1] or "",
            "rent": rm[2] or 0,
            "maintenance": rm[3] or 0,
            "deposit": rm[4] or 0,
            "lease_type": rm[5] or "월세",
            "pay_timing": rm[6] or "후불",
            "phone": rm[7] or "",
            "id_number": rm[8] or "",
            "move_in": rm[9] or "",
            "expiry": rm[10] or "",
            "move_out": rm[11] or "",
            "payments": pays_by_room.get(rn, {})
        }
        rooms_list.append(r_dict)

    conn.close()

    # Write seed_data.json
    seed_payload = {
        "rooms": rooms_list,
        "branch_id": "main",
        "branch_name": "시크빌"
    }
    with open(SEED_PATH, "w", encoding="utf-8") as f:
        json.dump(seed_payload, f, ensure_ascii=False, indent=2)
    print(f"Exported {len(rooms_list)} rooms to {SEED_PATH}")

    # Write chicvill_backup.json
    with open(BACKUP_PATH, "w", encoding="utf-8") as f:
        json.dump(seed_payload, f, ensure_ascii=False, indent=2)
    print(f"Exported to {BACKUP_PATH}")

if __name__ == "__main__":
    export_data()
