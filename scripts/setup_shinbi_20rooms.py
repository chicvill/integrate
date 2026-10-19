"""
scripts/setup_shinbi_20rooms.py
건물 정보(건물명, 주소, 연락처 등)는 온전히 보존하고,
오직 '임차 정보(세입자, 호실 계약, 납부 내역)'만 초기화 및 신규 20개실로 교체하는 표준 스크립트.
"""
import sqlite3
import uuid
import json
import os
import sys

DB_PATH = '/app/data/rent.db'
if not os.path.exists(DB_PATH):
    DB_PATH = 'apps/rent/backend/rent.db' if os.path.exists('apps/rent/backend/rent.db') else 'rent.db'

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# 1. 대상 지점 확인 및 건물명 보존/설정
# branch_id='main' 지점 조회
c.execute("SELECT branch_id, name, address, contact_phone FROM rent_branches WHERE branch_id='main'")
branch_row = c.fetchone()

# 전달된 인자나 기존 이름 확인 (선호빌 / 신비주택)
target_building_name = "선호빌"
if len(sys.argv) > 1 and sys.argv[1]:
    target_building_name = sys.argv[1]
elif branch_row and branch_row[1] and "시크빌" not in branch_row[1]:
    target_building_name = branch_row[1]

if not branch_row:
    # 지점이 없으면 신규 생성
    c.execute("""
        INSERT INTO rent_branches (id, branch_id, name, contact_phone, address, fee_plan, monthly_fee, billing_status, billing_due_day, is_active)
        VALUES (?, 'main', ?, '010-0000-0000', '', '원룸 20실형', 150000, 'PAID', 25, 1)
    """, (str(uuid.uuid4()), target_building_name))
else:
    # 건물 정보는 온전히 유지하되, 건물명을 정확히 반영
    c.execute("UPDATE rent_branches SET name=? WHERE branch_id='main'", (target_building_name,))

# 2. 건물 정보는 남기고, '임차 정보(호실 계약 및 수납 내역)'만 깨끗이 초기화
c.execute("DELETE FROM rent_rooms WHERE branch_id='main'")
c.execute("DELETE FROM rent_payments WHERE branch_id='main'")

# 3. 신규 20개실 실물 임차 정보 주입
rooms = [
    ("101", "고종훈", "2026-05-24", 2000000, 250000, 80000, "후불", "010-4281-6453", "납부일: 24일 / 키: 1907"),
    ("102", "이진원", "2024-07-21", 3000000, 250000, 50000, "후불", "010-6889-6285", "납부일: 4일 / 키: 1842"),
    ("103", "정상모", "2023-12-31", 2000000, 280000, 50000, "후불", "010-4261-0677", "미수: 231만원 / 부인 정미옥: 010-3949-8072"),
    ("104", "함현덕", "2020-05-12", 2000000, 280000, 30000, "후불", "010-8443-2513", "납부일: 20일 / 키: 1842"),
    ("105", "김태룡", "2026-07-16", 2000000, 250000, 50000, "후불", "010-4382-1812", "납부일: 17일 / 키: 1842"),
    ("201", "조정범", "2015-10-24", 3000000, 300000, 30000, "후불", "010-7754-5679", "납부일: 24일 / 키: 0120*"),
    ("202", "양정희", "2023-02-15", 3000000, 250000, 100000, "후불", "010-3338-6925", "동생 거주 (010-7672-6925) / 납부일: 15일"),
    ("203", "이종철", "2023-04-08", 3000000, 270000, 100000, "후불", "010-5526-2512", "부친 (010-7243-8944) / 납부일: 9일"),
    ("204", "석동준", "2025-05-22", 3000000, 250000, 70000, "후불", "010-3346-9703", "모친 황계남 (010-7765-0268) / 납부일: 21일"),
    ("205", "지수인", "2021-01-26", 3000000, 320000, 30000, "후불", "010-2716-7107", "김태현 (010-3662-9935) / 납부일: 24일"),
    ("301", "김성호", "2015-01-24", 3000000, 290000, 50000, "후불", "010-2297-4220", "납부일: 29일 / 키: 0822"),
    ("302", "김성규", "2016-03-09", 3000000, 320000, 30000, "후불", "010-6362-0582", "납부일: 10일 / 키: 1395"),
    ("303", "박종선", "2025-06-08", 3000000, 280000, 70000, "후불", "010-7329-5058", "친구 최영규 (010-6480-2023) / 납부일: 29일"),
    ("304", "정관섭", "2025-01-18", 3000000, 250000, 100000, "후불", "010-3184-5900", "자녀 정지원 (010-2988-6086) / 납부일: 18일"),
    ("305", "송길환", "2024-06-07", 3000000, 270000, 100000, "후불", "010-9699-1212", "27년 3/7까지 반납 / 납부일: 15일"),
    ("401", "정혜린", "2026-02-21", 3000000, 280000, 100000, "후불", "010-7181-3622", "민테크 사장 (010-4433-8823) / 납부일: 21일"),
    ("402", "하정호", "2026-05-26", 3000000, 280000, 100000, "후불", "010-2389-6739", "납부일: 30일 / 키: 0818"),
    ("403", "전상열", "2024-04-28", 3000000, 290000, 80000, "후불", "010-2923-2292", "납부일: 28일 / 키: 2292"),
    ("404", "유석희", "2017-04-14", 3000000, 320000, 30000, "선불", "010-4906-8642", "미수: 35만원 / 키: 332"),
    ("405", "이송남", "2020-10-31", 3000000, 320000, 30000, "후불", "010-5409-1961", "납부일: 26일 / 키: 561")
]

for item in rooms:
    r_id = str(uuid.uuid4())
    room_num, name, move_in, deposit, rent, maint, pay_timing, phone, note = item
    meta = json.dumps({"note": note, "phone": phone})
    c.execute("""
        INSERT INTO rent_rooms (id, branch_id, room_number, name, id_number, phone, lease_type, pay_timing, deposit, rent, maintenance, clean_fee, move_in, expiry, move_out, metadata_json)
        VALUES (?, 'main', ?, ?, '', ?, '월세', ?, ?, ?, ?, 80000, ?, '', '', ?)
    """, (r_id, int(room_num), name, phone, pay_timing, deposit, rent, maint, move_in, meta))

    for m in range(1, 13):
        p_id = str(uuid.uuid4())
        c.execute("""
            INSERT INTO rent_payments (id, branch_id, room_number, year, month, paid, paid_date, rent_amount, maintenance_amount, note, tenant_name, tenant_id_number, is_previous_tenant)
            VALUES (?, 'main', ?, 2026, ?, 0, '', ?, ?, '', ?, '', 0)
        """, (p_id, int(room_num), m, rent, maint, name))

conn.commit()
final_branch = c.execute("SELECT name FROM rent_branches WHERE branch_id='main'").fetchone()[0]
total_rooms = c.execute("SELECT COUNT(*) FROM rent_rooms WHERE branch_id='main'").fetchone()[0]
print(f"🎉 건물 정보 보존 완료! 건물명: [{final_branch}] / 임차 정보 갱신: 총 {total_rooms}개실 등록 완료")
conn.close()
