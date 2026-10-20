"""
scripts/import_rent_to_rent2.py
기존 integrat.db (rent_rooms, rent_payments, rent_expenses, rent_tenant_histories)의
모든 실제 임차 데이터를 rent2 객체 스토어로 1:1 완벽 마이그레이션한다.
"""
import json
import os
import sqlite3
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from apps.rent2.backend.kernel.base import use_store, store
from apps.rent2.backend.domain.rent import Building, Contract, Payment, Expense, num
from apps.rent2.backend.domain import ALIASES, bootstrap

SRC_DB = os.path.join(ROOT, "integrat.db")
DEST_DB = os.path.join(ROOT, "apps", "rent2", "data", "rent2.db")


def migrate():
    print(f"[*] 마이그레이션 시작: {SRC_DB} -> {DEST_DB}")
    if not os.path.exists(SRC_DB):
        print(f"[!] 원본 DB가 없습니다: {SRC_DB}")
        return

    os.makedirs(os.path.dirname(DEST_DB), exist_ok=True)
    use_store(DEST_DB)
    bootstrap()

    con = sqlite3.connect(SRC_DB)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # 1. 건물(지점) 마이그레이션
    branches = cur.execute("SELECT * FROM rent_branches").fetchall()
    print(f"[*] 건물(지점) {len(branches)}개 처리 중...")
    for b_row in branches:
        bid = b_row["branch_id"] or b_row["id"]
        b = Building.get(bid)
        if not b:
            b = Building(
                id=bid,
                name=b_row["name"] or bid,
                contact_phone=b_row["contact_phone"] or "",
                address=b_row["address"] or "",
                fee_plan=b_row["fee_plan"] or "원룸 프리미엄 29실형",
                monthly_fee=num(b_row["monthly_fee"] or 150000),
                billing_due_day=num(b_row["billing_due_day"] or 25),
                billing_status=b_row["billing_status"] or "ACTIVE",
                last_paid_at=b_row["last_paid_at"] or "",
                aliases=ALIASES.get(bid, [])
            )
            b.save("imported")
        else:
            b.name = b_row["name"] or b.name
            b.contact_phone = b_row["contact_phone"] or b.contact_phone
            b.address = b_row["address"] or b.address
            b.save("updated")

    # 2. 호실 및 현재 계약 (rent_rooms) 마이그레이션
    rooms = cur.execute("SELECT * FROM rent_rooms").fetchall()
    print(f"[*] 현재 호실/계약 {len(rooms)}개 처리 중...")
    with store().tx(quiet=True):
        for r in rooms:
            bid = r["branch_id"] or "main"
            b = Building.require(bid)
            r_num = int(r["room_number"])
            b.add_unit(r_num)

            # 세입자가 있는 경우 계약 객체 생성
            if r["name"]:
                memo = {}
                if r["metadata_json"]:
                    try:
                        memo = json.loads(r["metadata_json"]) if isinstance(r["metadata_json"], str) else (r["metadata_json"] or {})
                    except Exception:
                        pass
                # 기존 활성 계약이 있는지 확인
                existing = [c for c in Contract.find(bid, unit=r_num) if c.active]
                c_obj = existing[0] if existing else Contract(building_id=bid, unit=r_num)
                c_obj.tenant_name = r["name"] or ""
                c_obj.id_number = r["id_number"] or ""
                c_obj.phone = r["phone"] or ""
                c_obj.lease_type = r["lease_type"] or "월세"
                c_obj.pay_timing = r["pay_timing"] or "후불"
                c_obj.deposit = num(r["deposit"])
                c_obj.rent = num(r["rent"])
                c_obj.maintenance = num(r["maintenance"])
                c_obj.clean_fee = num(r["clean_fee"])
                c_obj.move_in = r["move_in"] or ""
                c_obj.expiry = r["expiry"] or ""
                c_obj.move_out = r["move_out"] or ""
                c_obj.memo = memo
                c_obj.save("imported")

    # 3. 전출자 이력 (rent_tenant_histories) 마이그레이션
    histories = cur.execute("SELECT * FROM rent_tenant_histories").fetchall()
    print(f"[*] 전출자 이력 {len(histories)}개 처리 중...")
    with store().tx(quiet=True):
        for h in histories:
            bid = h["branch_id"] or "main"
            r_num = int(h["room_number"])
            b = Building.require(bid)
            b.add_unit(r_num)

            memo = {}
            if h["metadata_json"]:
                try:
                    memo = json.loads(h["metadata_json"]) if isinstance(h["metadata_json"], str) else (h["metadata_json"] or {})
                except Exception:
                    pass

            c_obj = Contract(
                building_id=bid,
                unit=r_num,
                tenant_name=h["name"] or "전출자",
                id_number=h["id_number"] or "",
                phone=h["phone"] or "",
                lease_type=h["lease_type"] or "월세",
                pay_timing=h["pay_timing"] or "후불",
                deposit=num(h["deposit"]),
                rent=num(h["rent"]),
                maintenance=num(h["maintenance"]),
                clean_fee=num(h["clean_fee"]),
                move_in=h["move_in"] or "",
                expiry=h["expiry"] or "",
                move_out=h["move_out"] or "2025-12-31",
                memo=memo
            )
            c_obj.save("imported_history")

    # 4. 수납 사실 기록 (rent_payments) 마이그레이션
    payments = cur.execute("SELECT * FROM rent_payments").fetchall()
    print(f"[*] 수납 기록 {len(payments)}개 처리 중...")
    p_count = 0
    with store().tx(quiet=True):
        for p in payments:
            bid = p["branch_id"] or "main"
            r_num = int(p["room_number"])
            y, m = int(p["year"]), int(p["month"])
            pid = Payment.pid(bid, r_num, y, m)

            # 계산값과 차이가 있거나 실 납부 사실이 있는 경우 기록 저장
            p_obj = Payment(
                id=pid,
                building_id=bid,
                unit=r_num,
                year=y,
                month=m,
                paid=bool(p["paid"]),
                paid_date=p["paid_date"] or "",
                rent_amount=num(p["rent_amount"]) if p["paid"] else None,
                maintenance_amount=num(p["maintenance_amount"]) if p["paid"] else None,
                note=p["note"] or ""
            )
            p_obj.save("imported")
            p_count += 1

    # 5. 지출 전표 (rent_expenses) 마이그레이션
    expenses = cur.execute("SELECT * FROM rent_expenses").fetchall()
    print(f"[*] 지출 전표 {len(expenses)}개 처리 중...")
    with store().tx(quiet=True):
        for e in expenses:
            bid = e["branch_id"] or "main"
            e_obj = Expense(
                building_id=bid,
                date=e["date"] or "",
                item=e["item"] or "지출",
                amount=num(e["amount"]),
                note=e["note"] or "",
                receipt_type=e["receipt_type"] or "신용카드",
                receipt_info=e["receipt_info"] or ""
            )
            e_obj.save("imported")

    con.close()
    print("=" * 60)
    print(f"[v] 마이그레이션 완료!")
    for b in Building.all():
        st = b.stats()
        print(f" - 건물: {b.name} ({b.id}) | 전체 {st['total_rooms']}실 (공실 {st['vacant_rooms']}실) | 계약 {len(Contract.find(b.id))}건 | 수납 {len(Payment.find(b.id))}건 | 지출 {len(b.expenses())}건")
    print("=" * 60)


if __name__ == "__main__":
    migrate()
