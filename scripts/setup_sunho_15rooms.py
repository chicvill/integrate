"""
scripts/setup_sunho_15rooms.py
선호빌 (15개실) 실물 장부 기반 호실 계약 및 수납 내역 세팅 스크립트.
"""
import sqlite3
import uuid
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    getattr(sys.stdout, "reconfigure")(encoding="utf-8")

TARGET_NAME = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else "선호빌"
BID = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else "branch_5611"
if BID == "main":
    sys.exit("❌ 'main'(시크빌 본점) 데이터는 이 스크립트로 덮어쓸 수 없습니다.")

DB_PATH: str | None = sys.argv[3] if len(sys.argv) > 3 else None
if not DB_PATH:
    for cand in ['integrat.db', '/media/integrat.db', '/app/data/rent.db', 'apps/rent/backend/rent.db', 'rent.db']:
        if os.path.exists(cand):
            DB_PATH = cand
            break

if not DB_PATH:
    sys.exit("❌ DB 파일을 찾을 수 없습니다. 3번째 인자로 DB 경로를 지정하세요.")

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# 1. 대상 지점 확인 및 등록
c.execute("SELECT branch_id, name FROM rent_branches WHERE branch_id=?", (BID,))
branch_row = c.fetchone()
if not branch_row:
    c.execute("""
        INSERT INTO rent_branches (id, branch_id, name, contact_phone, address, fee_plan, monthly_fee, billing_status, billing_due_day, is_active, metadata_json)
        VALUES (?, ?, ?, '010-0000-0000', '', '원룸 15실형', 120000, 'PAID', 25, 1, '{}')
    """, (str(uuid.uuid4()), BID, TARGET_NAME))
else:
    c.execute("UPDATE rent_branches SET name=? WHERE branch_id=?", (TARGET_NAME, BID))

# 2. 기존 임차 정보 초기화 (해당 branch_id에 한함)
c.execute("DELETE FROM rent_rooms WHERE branch_id=?", (BID,))
c.execute("DELETE FROM rent_payments WHERE branch_id=?", (BID,))

# 3. 선호빌 15개실 실물 임차 장부 데이터
# (호실, 세입자, 전입일, 보증금, 월세, 관리비, 납부유형, 연락처, 비고, {월: 입금일자})
rooms_data = [
    ("201", "윤영규", "2021-02-01", 5000000, 500000, 0, "후불", "010-8856-4915", "장부 2026 전월세", {1: "2026-02-02", 2: "2026-03-03", 3: "2026-04-11", 4: "2026-05-02"}),
    ("202", "김수성", "2025-06-24", 5000000, 550000, 0, "후불", "010-7250-7800", "장부 2026 전월세", {1: "2026-01-25", 2: "2026-02-25", 3: "2026-03-21", 4: "2026-04-25"}),
    ("203", "이선아", "2021-01-26", 5000000, 500000, 0, "후불", "010-2272-0167", "장부 2026 전월세", {1: "2026-02-25", 2: "2026-03-25", 3: "2026-04-25", 4: "2026-05-24"}),
    ("204", "김영규", "2024-05-26", 5000000, 550000, 0, "후불", "010-5092-2750", "장부 2026 전월세", {1: "2026-02-25", 2: "2026-02-25", 3: "2026-03-25", 4: "2026-04-30"}),
    ("205", "김현주", "2025-06-30", 5000000, 550000, 0, "후불", "010-2771-7169", "장부 2026 전월세", {1: "2026-02-15", 2: "2026-03-15", 3: "2026-04-14", 4: "2026-05-13"}),
    ("206", "김선호", "2026-04-10", 5000000, 550000, 0, "후불", "010-4400-5942", "장부 2026 전월세 (4월 입주)", {}),
    ("301", "이호진", "2021-05-10", 0,       550000, 0, "후불", "010-9369-1666", "장부 2026 전월세 (무보증)", {1: "2026-01-17", 2: "2026-02-07", 3: "2026-03-08", 4: "2026-04-08"}),
    ("302", "유순열", "2022-09-03", 10000000, 500000, 0, "후불", "010-8439-6232", "장부 2026 전월세", {1: "2026-01-05", 2: "2026-02-04", 3: "2026-03-05", 4: "2026-04-03"}),
    ("303", "홍현기", "2024-04-19", 5000000, 550000, 0, "후불", "010-8652-5721", "장부 2026 전월세", {1: "2026-01-18", 2: "2026-02-18", 3: "2026-03-18", 4: "2026-04-18"}),
    ("304", "정현욱", "2025-03-24", 5000000, 550000, 0, "후불", "010-8279-1964", "장부 2026 전월세", {1: "2026-01-22", 2: "2026-02-22", 3: "2026-03-22", 4: "2026-04-16"}),
    ("305", "배영익", "2017-03-08", 5000000, 500000, 0, "후불", "010-8584-1089", "장부 2026 전월세", {1: "2026-01-30", 2: "2026-02-28", 3: "2026-03-25", 4: "2026-04-24"}),
    ("306", "안상영", "2017-10-25", 5000000, 500000, 0, "후불", "010-3714-0812", "장부 2026 전월세", {1: "2026-02-01", 2: "2026-02-28", 3: "2026-03-31", 4: "2026-04-30"}),
    ("402", "서용원", "2026-09-01", 5000000, 650000, 0, "후불", "010-4707-0509", "장부 2026 전월세 (9월 입주예정)", {}),
    ("403", "홍광택", "2023-11-30", 5000000, 550000, 0, "후불", "010-9924-8246", "장부 2026 전월세", {1: "2026-01-31", 2: "2026-02-28", 3: "2026-03-31", 4: "2026-04-30"}),
    ("404", "정홍대", "2020-05-14", 5000000, 600000, 0, "후불", "010-5349-2190", "장부 2026 전월세", {1: "2026-03-31", 2: "2026-03-31", 3: "2026-04-03", 4: "2026-05-30"})
]

for item in rooms_data:
    room_num, name, move_in, deposit, rent, maint, pay_timing, phone, note, payments = item
    r_id = str(uuid.uuid4())
    meta = json.dumps({"note": note, "phone": phone})
    c.execute("""
        INSERT INTO rent_rooms (id, branch_id, room_number, name, id_number, phone, lease_type, pay_timing, deposit, rent, maintenance, clean_fee, move_in, expiry, move_out, metadata_json)
        VALUES (?, ?, ?, ?, '', ?, '월세', ?, ?, ?, ?, 80000, ?, '', '', ?)
    """, (r_id, BID, int(room_num), name, phone, pay_timing, deposit, rent, maint, move_in, meta))

    for m in range(1, 13):
        p_id = str(uuid.uuid4())
        paid_date = payments.get(m, "")
        is_paid = 1 if paid_date else 0
        p_note = f"장부수납 {paid_date}" if paid_date else ""
        c.execute("""
            INSERT INTO rent_payments (id, branch_id, room_number, year, month, paid, paid_date, rent_amount, maintenance_amount, note, tenant_name, tenant_id_number, is_previous_tenant)
            VALUES (?, ?, ?, 2026, ?, ?, ?, ?, ?, ?, ?, '', 0)
        """, (p_id, BID, int(room_num), m, is_paid, paid_date, rent, maint, p_note, name))

conn.commit()
final_branch = c.execute("SELECT name FROM rent_branches WHERE branch_id=?", (BID,)).fetchone()[0]
total_rooms = c.execute("SELECT COUNT(*) FROM rent_rooms WHERE branch_id=?", (BID,)).fetchone()[0]
print(f"🎉 [{final_branch}] 총 {total_rooms}개실 등록 및 2026년도 수납 내역 주입 완료!")
conn.close()
