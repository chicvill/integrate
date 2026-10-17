import sqlite3
import json
import os
import uuid

def run():
    db_paths = ['/app/integrat.db', '/app/data/integrated.db', 'integrat.db']
    conn = None
    for p in db_paths:
        if os.path.exists(p):
            conn = sqlite3.connect(p)
            break
    if not conn:
        conn = sqlite3.connect('/app/integrat.db')
        
    c = conn.cursor()

    # 컬럼 확인 및 추가
    cols = [r[1] for r in c.execute('PRAGMA table_info(rent_expenses)').fetchall()]
    if 'receipt_type' not in cols:
        c.execute('ALTER TABLE rent_expenses ADD COLUMN receipt_type VARCHAR(50) DEFAULT ""')
    if 'receipt_info' not in cols:
        c.execute('ALTER TABLE rent_expenses ADD COLUMN receipt_info TEXT DEFAULT ""')

    try:
        c.execute("UPDATE rent_branches SET name = '시크빌 (29개실)' WHERE branch_id = 'main'")
    except Exception as e:
        pass

    # seed_data.json 파일 로드 및 main 지점 실데이터 적재
    json_paths = [
        '/app/apps/rent/backend/seed_data.json',
        '/app/backend/seed_data.json',
        'apps/rent/backend/seed_data.json',
        os.path.join(os.path.dirname(__file__), 'seed_data.json')
    ]
    seed_data = None
    for jp in json_paths:
        if os.path.exists(jp) and os.path.getsize(jp) > 0:
            try:
                with open(jp, 'r', encoding='utf-8') as f:
                    seed_data = json.load(f)
                print(f"Loaded seed data from {jp}")
                break
            except Exception as e:
                print(f"Failed to load {jp}: {e}")

    if seed_data and 'data' in seed_data:
        data_block = seed_data['data']
        rooms_dict = data_block.get('rooms', {})
        expenses_list = data_block.get('expenses', [])
        histories_list = data_block.get('tenantHistories', [])

        # main 지점 룸 데이터 동기화
        for r_num_str, r_info in rooms_dict.items():
            r_num = int(r_num_str)
            existing_room = c.execute("SELECT id FROM rent_rooms WHERE branch_id = 'main' AND room_number = ?", (r_num,)).fetchone()
            room_id = existing_room[0] if existing_room else str(uuid.uuid4())
            
            if existing_room:
                c.execute("""
                    UPDATE rent_rooms SET
                        name = ?, id_number = ?, phone = ?, lease_type = ?, pay_timing = ?,
                        deposit = ?, rent = ?, maintenance = ?, clean_fee = ?,
                        move_in = ?, expiry = ?, move_out = ?
                    WHERE id = ?
                """, (
                    r_info.get("name", "") or "",
                    r_info.get("id_number", "") or "",
                    r_info.get("phone", "") or "",
                    r_info.get("lease_type", "월세") or "월세",
                    r_info.get("pay_timing", "후불") or "후불",
                    int(r_info.get("deposit") or 0),
                    int(r_info.get("rent") or 0),
                    int(r_info.get("maintenance") or 0),
                    int(r_info.get("clean_fee") or 0),
                    r_info.get("move_in", "") or "",
                    r_info.get("expiry", "") or "",
                    r_info.get("move_out", "") or "",
                    room_id
                ))
            else:
                c.execute("""
                    INSERT INTO rent_rooms (
                        id, branch_id, room_number, name, id_number, phone, lease_type, pay_timing,
                        deposit, rent, maintenance, clean_fee, move_in, expiry, move_out, metadata_json
                    ) VALUES (?, 'main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    room_id, r_num,
                    r_info.get("name", "") or "",
                    r_info.get("id_number", "") or "",
                    r_info.get("phone", "") or "",
                    r_info.get("lease_type", "월세") or "월세",
                    r_info.get("pay_timing", "후불") or "후불",
                    int(r_info.get("deposit") or 0),
                    int(r_info.get("rent") or 0),
                    int(r_info.get("maintenance") or 0),
                    int(r_info.get("clean_fee") or 0),
                    r_info.get("move_in", "") or "",
                    r_info.get("expiry", "") or "",
                    r_info.get("move_out", "") or "",
                    json.dumps(r_info.get("metadata_json") or {})
                ))

            # 납부 내역 업데이트
            payments_dict = r_info.get("payments", {})
            seen = set()
            for p_key, p_val in payments_dict.items():
                m = p_val.get("month")
                y = p_val.get("year", 2026)
                if not m or (y, m) in seen:
                    continue
                seen.add((y, m))
                is_paid = 1 if p_val.get("paid", False) else 0
                paid_date = p_val.get("paid_date", "") or ""
                rent_amt = int(p_val.get("rent_amount") or 0)
                maint_amt = int(p_val.get("maintenance_amount") or 0)
                note = p_val.get("note", "") or ""
                tenant_name = p_val.get("tenant_name", "") or r_info.get("name", "")
                
                tenant_id_num = p_val.get("tenant_id_number", "") or r_info.get("id_number", "") or ""
                existing_pay = c.execute("SELECT id FROM rent_payments WHERE branch_id = 'main' AND room_number = ? AND year = ? AND month = ?", (r_num, y, m)).fetchone()
                if existing_pay:
                    c.execute("""
                        UPDATE rent_payments SET
                            paid = ?, paid_date = ?, rent_amount = ?, maintenance_amount = ?,
                            note = ?, tenant_name = ?, tenant_id_number = ?
                        WHERE id = ?
                    """, (is_paid, paid_date, rent_amt, maint_amt, note, tenant_name, tenant_id_num, existing_pay[0]))
                else:
                    c.execute("""
                        INSERT INTO rent_payments (
                            id, branch_id, room_number, year, month, paid, paid_date,
                            rent_amount, maintenance_amount, note, tenant_name, tenant_id_number, is_previous_tenant
                        ) VALUES (?, 'main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    """, (str(uuid.uuid4()), r_num, y, m, is_paid, paid_date, rent_amt, maint_amt, note, tenant_name, tenant_id_num))

        # 지출 내역 업데이트
        c.execute("DELETE FROM rent_expenses WHERE branch_id = 'main'")
        for exp in expenses_list:
            c.execute("""
                INSERT INTO rent_expenses (
                    id, branch_id, date, item, amount, note, receipt_type, receipt_info
                ) VALUES (?, 'main', ?, ?, ?, ?, ?, ?)
            """, (
                exp.get("id") or str(uuid.uuid4()),
                exp.get("date", "2026-10-15"),
                exp.get("item", "지출"),
                int(exp.get("amount") or 0),
                exp.get("note", ""),
                exp.get("receipt_type", ""),
                exp.get("receipt_info", "")
            ))

        # 전출자 이력 업데이트
        c.execute("DELETE FROM rent_tenant_histories WHERE branch_id = 'main'")
        for th in histories_list:
            c.execute("""
                INSERT INTO rent_tenant_histories (
                    id, branch_id, room_number, name, id_number, phone, lease_type, pay_timing,
                    deposit, rent, maintenance, clean_fee, move_in, expiry, move_out, retention_until, metadata_json
                ) VALUES (?, 'main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                th.get("id") or str(uuid.uuid4()),
                int(th.get("room_number") or 0),
                th.get("name", ""),
                th.get("id_number", ""),
                th.get("phone", ""),
                th.get("lease_type", "월세"),
                th.get("pay_timing", "후불"),
                int(th.get("deposit") or 0),
                int(th.get("rent") or 0),
                int(th.get("maintenance") or 0),
                int(th.get("clean_fee") or 80000),
                th.get("move_in", ""),
                th.get("expiry", ""),
                th.get("move_out", ""),
                th.get("retention_until", ""),
                json.dumps(th.get("metadata_json") or {})
            ))
        print("Synchronized all 29 rooms, expenses, and tenant histories from seed_data.json!")

    # rent_payments 중복 레코드 정리
    try:
        rows = c.execute("SELECT id, branch_id, room_number, year, month, paid, paid_date, note FROM rent_payments").fetchall()
        grouped = {}
        for r in rows:
            pid, branch_id, room_number, year, month, paid, paid_date, note = r
            key = (branch_id, room_number, year, month)
            grouped.setdefault(key, []).append(r)

        deleted = 0
        for key, p_list in grouped.items():
            if len(p_list) > 1:
                p_list.sort(key=lambda x: (1 if x[5] else 0, len(x[6] or ''), len(x[7] or '')), reverse=True)
                for extra in p_list[1:]:
                    c.execute("DELETE FROM rent_payments WHERE id = ?", (extra[0],))
                    deleted += 1
        print(f"Deduplicated rent_payments: removed {deleted} duplicate rows.")

        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_rent_payments_branch_room_year_month ON rent_payments(branch_id, room_number, year, month)")
    except Exception as e:
        print("Dedup index error:", e)

    conn.commit()
    conn.close()
    print("DB Migration & Deduplication successfully completed!")

if __name__ == '__main__':
    run()
