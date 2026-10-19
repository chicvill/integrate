"""
scripts/batch_pay_shinbi.py
신비주택(branch_9348) 20개실의 2026년도 임대료 및 관리비 일괄 수납(완납) 처리 스크립트.
- 각 호실의 입주일(move_in) 이후 기간(1월~10월)을 각 호실의 약정 납부일에 맞춰 완납 처리합니다.
"""
import sqlite3
import re
import sys
import os

DB_PATH: str | None = sys.argv[1] if len(sys.argv) > 1 else None
if not DB_PATH:
    for cand in ['/media/integrat.db', '/app/data/rent.db', 'apps/rent/backend/rent.db', 'rent.db']:
        if os.path.exists(cand):
            DB_PATH = cand
            break

if not DB_PATH:
    sys.exit("❌ DB 파일을 찾을 수 없습니다.")

BID = "branch_9348"
TARGET_YEAR = 2026
MAX_MONTH = 10  # 당월(10월)까지 일괄 수납

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# 1. 신비주택 호실 정보 조회
c.execute("SELECT room_number, name, move_in, rent, maintenance, metadata_json FROM rent_rooms WHERE branch_id=?", (BID,))
rooms = c.fetchall()

if not rooms:
    sys.exit(f"❌ '{BID}'(신비주택)의 호실 정보가 없습니다.")

updated_count = 0
current_month_paid_count = 0

for room_num, name, move_in, rent, maint, meta_str in rooms:
    # 납부 약정일 파싱 (예: "납부일: 24일" -> 24)
    pay_day = 25
    if meta_str:
        m_day = re.search(r'납부일:\s*(\d+)일', meta_str)
        if m_day:
            pay_day = min(int(m_day.group(1)), 28)
        else:
            m_day2 = re.search(r'(\d+)일', meta_str)
            if m_day2:
                pay_day = min(int(m_day2.group(1)), 28)

    # 입주 연월 파싱
    in_year = 2000
    in_month = 1
    if move_in and len(move_in) >= 7:
        parts = move_in.split("-")
        in_year = int(parts[0])
        in_month = int(parts[1])

    for m in range(1, 13):
        # 2026년 당해 연도에서 입주일 이전 달은 미입주
        if TARGET_YEAR < in_year or (TARGET_YEAR == in_year and m < in_month):
            # 입주 전 기간
            c.execute("""
                UPDATE rent_payments
                SET paid=0, paid_date='', note='입주 전'
                WHERE branch_id=? AND room_number=? AND year=? AND month=?
            """, (BID, room_num, TARGET_YEAR, m))
            continue

        # 1월부터 MAX_MONTH(10월)까지는 일괄 완납 처리
        if m <= MAX_MONTH:
            paid_date = f"{TARGET_YEAR}-{m:02d}-{pay_day:02d}"
            c.execute("""
                UPDATE rent_payments
                SET paid=1, paid_date=?, note='정상 입금', rent_amount=?, maintenance_amount=?, tenant_name=?
                WHERE branch_id=? AND room_number=? AND year=? AND month=?
            """, (paid_date, rent, maint, name, BID, room_num, TARGET_YEAR, m))
            updated_count += 1
            if m == MAX_MONTH:
                current_month_paid_count += 1
        else:
            # 11, 12월은 미래 달이므로 미납 유지
            c.execute("""
                UPDATE rent_payments
                SET paid=0, paid_date='', note=''
                WHERE branch_id=? AND room_number=? AND year=? AND month=?
            """, (BID, room_num, TARGET_YEAR, m))

conn.commit()

# 검증 통계
c.execute("""
    SELECT COUNT(*), SUM(rent_amount + maintenance_amount)
    FROM rent_payments
    WHERE branch_id=? AND year=? AND month=? AND paid=1
""", (BID, TARGET_YEAR, MAX_MONTH))
paid_10_count, paid_10_amount = c.fetchone()

c.execute("""
    SELECT COUNT(*), SUM(rent_amount + maintenance_amount)
    FROM rent_payments
    WHERE branch_id=? AND year=? AND month=?
""", (BID, TARGET_YEAR, MAX_MONTH))
tot_10_count, tot_10_amount = c.fetchone()

pay_rate = (paid_10_amount / tot_10_amount * 100) if tot_10_amount else 0

print(f"🎉 신비주택 일괄 수납 처리 완료!")
print(f"- 1~10월 총 수납 처리 건수: {updated_count}건")
print(f"- 2026년 10월(당월) 수납 실적: {paid_10_count}/{tot_10_count}실 완납")
print(f"- 10월 수납 금액: {paid_10_amount:,}원 / 목표 {tot_10_amount:,}원 ({pay_rate:.1f}%)")

conn.close()
