"""
scripts/populate_2025_chicvill.py
시크빌(main) 2025년도 29개실 공식 임차료 수납 내역을 파싱하여
로컬 SQLite DB(integrat.db, rent.db), seed_data.json, chicvill_backup.json에 적재합니다.
"""
import os
import sys
import csv
import re
import uuid
import json
import sqlite3

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
csv_candidates = [
    os.path.join(PROJECT_ROOT, "data", "chicvill_2025.csv"),
    os.path.join(os.path.dirname(__file__), "chicvill_2025.csv"),
    os.path.join(os.path.dirname(__file__), "..", "data", "chicvill_2025.csv"),
    "/app/apps/rent/backend/chicvill_2025.csv",
    "/app/data/chicvill_2025.csv"
]
CSV_PATH = next((p for p in csv_candidates if os.path.exists(p)), csv_candidates[0])

def parse_date(date_raw, month, default_day=25):
    if not date_raw:
        return ""
    d = date_raw.strip().replace(" ", "")
    
    # 25-12-3 -> 2025-12-03
    m_full = re.match(r"(\d{2,4})[-.](\d{1,2})[-.](\d{1,2})", d)
    if m_full:
        y, mo, day = m_full.groups()
        return f"2025-{int(mo):02d}-{int(day):02d}"
    
    # 2.3, 10-23, 11-3, 7/3, 12:21
    m_md = re.match(r"(\d{1,2})[-./:](\d{1,2})", d)
    if m_md:
        mo, day = m_md.groups()
        m_int = int(mo) if int(mo) <= 12 else month
        d_int = int(day) if int(day) <= 31 else default_day
        return f"2025-{m_int:02d}-{d_int:02d}"
    
    # 1015 -> 10.15, 115 -> 1.15
    if d.isdigit():
        if len(d) == 4:
            mo = int(d[:2])
            day = int(d[2:])
            if 1 <= mo <= 12 and 1 <= day <= 31:
                return f"2025-{mo:02d}-{day:02d}"
        elif len(d) == 3:
            mo = int(d[0])
            day = int(d[1:])
            if 1 <= mo <= 12 and 1 <= day <= 31:
                return f"2025-{mo:02d}-{day:02d}"
            
    return ""

def load_chicvill_2025_data():
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"CSV file not found: {CSV_PATH}")

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    room_rows = [r for r in rows if len(r) > 0 and r[0].strip().isdigit()]
    
    parsed_records = []
    
    for r in room_rows:
        room_no = int(r[0].strip())
        name = r[1].strip()
        timing = r[2].strip()

        for m in range(1, 13):
            d_col = 3 + 2 * m
            a_col = 4 + 2 * m
            d_raw = r[d_col].strip() if d_col < len(r) else ""
            a_raw = r[a_col].strip() if a_col < len(r) else ""

            # Check if note is in amount column (like '전입', '공실', '미납' or date like '5/26')
            note = ""
            if any(k in a_raw for k in ["공실", "전입", "미납", "주인"]) or ("/" in a_raw and not any(k in a_raw for k in [",", "000"])):
                note = a_raw
                a_raw = ""
            if any(k in d_raw for k in ["공실", "전입", "미납", "주인"]):
                note = (note + " " + d_raw).strip()

            clean_digits = re.sub(r"[^\d]", "", a_raw)
            amt = int(clean_digits) if clean_digits else 0

            paid = (amt > 0)
            paid_date = parse_date(d_raw, m) if paid else ""
            if paid and not paid_date:
                paid_date = f"2025-{m:02d}-25"

            parsed_records.append({
                "room_number": room_no,
                "tenant_name": name,
                "pay_timing": timing,
                "year": 2025,
                "month": m,
                "paid": paid,
                "paid_date": paid_date,
                "rent_amount": amt,
                "maintenance_amount": 0,
                "note": note
            })

    return parsed_records

def populate_sqlite(db_path, records):
    if not os.path.exists(db_path):
        print(f"⏩ DB 건너뜀 (파일 없음): {db_path}")
        return

    print(f"🔄 SQLite DB 2025년 수납 적재 시작: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # rent_payments 테이블 확인
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='rent_payments'")
    if not c.fetchone():
        print(f"❌ rent_payments 테이블이 없습니다: {db_path}")
        conn.close()
        return

    inserted = 0
    updated = 0

    for rec in records:
        branch_id = "main"
        r_num = rec["room_number"]
        y = rec["year"]
        m = rec["month"]
        paid = 1 if rec["paid"] else 0
        paid_date = rec["paid_date"]
        rent_amt = rec["rent_amount"]
        maint_amt = rec["maintenance_amount"]
        note = rec["note"]
        t_name = rec["tenant_name"]

        c.execute("""
            SELECT id FROM rent_payments 
            WHERE branch_id = ? AND room_number = ? AND year = ? AND month = ?
        """, (branch_id, r_num, y, m))
        row = c.fetchone()

        if row:
            c.execute("""
                UPDATE rent_payments 
                SET paid = ?, paid_date = ?, rent_amount = ?, maintenance_amount = ?, note = ?, tenant_name = ?
                WHERE id = ?
            """, (paid, paid_date, rent_amt, maint_amt, note, t_name, row[0]))
            updated += 1
        else:
            new_id = str(uuid.uuid4())
            c.execute("""
                INSERT INTO rent_payments (id, branch_id, room_number, year, month, paid, paid_date, rent_amount, maintenance_amount, note, tenant_name, tenant_id_number, is_previous_tenant)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0)
            """, (new_id, branch_id, r_num, y, m, paid, paid_date, rent_amt, maint_amt, note, t_name))
            inserted += 1

    conn.commit()
    conn.close()
    print(f"  [OK] {db_path} 완료: 추가 {inserted}건, 갱신 {updated}건 (총 {len(records)}건)")

def update_seed_json(json_path, records):
    if not os.path.exists(json_path):
        print(f"⏩ JSON 건너뜀 (파일 없음): {json_path}")
        return

    print(f"🔄 JSON 2025년 수납 데이터 동기화: {json_path}")
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Structure can be data["rooms"] or data["data"]["rooms"]
        rooms = None
        if "data" in data and isinstance(data["data"], dict) and "rooms" in data["data"]:
            rooms = data["data"]["rooms"]
        elif "rooms" in data:
            rooms = data["rooms"]

        if not rooms:
            print(f"  ⚠️ rooms 키를 찾을 수 없음: {json_path}")
            return

        updated_count = 0
        for rec in records:
            r_str = str(rec["room_number"])
            if r_str in rooms:
                r_obj = rooms[r_str]
                if "payments" not in r_obj:
                    r_obj["payments"] = {}
                key = f"2025-{rec['month']}"
                r_obj["payments"][key] = {
                    "year": 2025,
                    "month": rec["month"],
                    "paid": rec["paid"],
                    "paid_date": rec["paid_date"],
                    "rent_amount": rec["rent_amount"],
                    "maintenance_amount": rec["maintenance_amount"],
                    "note": rec["note"],
                    "tenant_name": rec["tenant_name"]
                }
                updated_count += 1

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"  [OK] JSON 갱신 완료: {updated_count}건 반영")
    except Exception as e:
        print(f"  ❌ JSON 갱신 실패: {e}")

def update_seed_data_js():
    try:
        candidates = [
            os.path.join(PROJECT_ROOT, "apps", "rent", "backend", "seed_data.json"),
            os.path.join(PROJECT_ROOT, "backend", "seed_data.json"),
            "/app/apps/rent/backend/seed_data.json",
            "/app/backend/seed_data.json"
        ]
        backend_json_path = next((p for p in candidates if os.path.exists(p)), None)
        if not backend_json_path:
            return

        with open(backend_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        rooms = data.get("data", {}).get("rooms", {})
        expenses = data.get("data", {}).get("expenses", [])
        histories = data.get("data", {}).get("tenantHistories", [])

        js_candidates = [
            os.path.join(PROJECT_ROOT, "apps", "rent", "frontend", "js", "seed_data.js"),
            os.path.join(PROJECT_ROOT, "frontend", "js", "seed_data.js"),
            "/app/apps/rent/frontend/js/seed_data.js"
        ]
        frontend_js_path = next((p for p in js_candidates if os.path.exists(os.path.dirname(p))), None)
        if not frontend_js_path:
            return

        js_content = f"""/**
 * apps/rent/frontend/js/seed_data.js
 * 29개실 표준 공인 장부 시드 데이터 (2025년 실데이터 완비)
 */
export const CANONICAL_ROOMS_DATA = {json.dumps(rooms, ensure_ascii=False, indent=2)};

export const DEFAULT_EXPENSES = {json.dumps(expenses, ensure_ascii=False, indent=2)};

export const DEFAULT_TENANT_HISTORIES = {json.dumps(histories, ensure_ascii=False, indent=2)};
"""
        with open(frontend_js_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        print("  [OK] seed_data.js 동기화 완료")
    except Exception as e:
        print(f"  ⏩ seed_data.js 동기화 건너뜀: {e}")

def main():
    records = load_chicvill_2025_data()
    print(f"총 {len(records)}건의 2025년 월별 납입 데이터 추출 완료 (29개실 x 12개월).")

    # 1. SQLite DBs
    db_paths = [
        "/app/integrat.db",
        "/app/data/integrated.db",
        "/app/apps/rent/backend/rent.db",
        os.path.join(PROJECT_ROOT, "integrat.db"),
        os.path.join(PROJECT_ROOT, "data", "rent.db"),
        os.path.join(PROJECT_ROOT, "apps", "rent", "data", "rent.db"),
        os.path.join(PROJECT_ROOT, "apps", "rent", "backend", "rent.db")
    ]
    for db in db_paths:
        populate_sqlite(db, records)

    # 2. JSON files
    json_paths = [
        os.path.join(PROJECT_ROOT, "apps", "rent", "backend", "seed_data.json"),
        os.path.join(PROJECT_ROOT, "data", "chicvill_backup.json")
    ]
    for jp in json_paths:
        update_seed_json(jp, records)

    # 3. seed_data.js
    update_seed_data_js()

    print("\n🎉 시크빌 2025년 전수 데이터 로컬 적재가 완벽히 완료되었습니다!")

if __name__ == "__main__":
    main()
