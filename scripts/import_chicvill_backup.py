"""
scripts/import_chicvill_backup.py
시크빌 29개실 공식 전체 백업 JSON 데이터("시크빌__29개실__전체백업_20261013_141111.json")를
로컬 SQLite 데이터베이스(integrat.db 및 rent.db)로 완벽 임포트합니다.
"""
import os
import sys
import json
import uuid
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

JSON_BACKUP_PATH = os.path.join(PROJECT_ROOT, "data", "chicvill_backup.json")
if not os.path.exists(JSON_BACKUP_PATH):
    print(f"❌ 오류: 백업 JSON 파일을 찾을 수 없습니다: {JSON_BACKUP_PATH}")
    sys.exit(1)

from apps.rent.backend.db.models import (
    Base, RentBranch, RentRoom, RentPayment, RentExpense, RentTenantHistory, RentUser
)

# 대상 DB 경로 목록 (로컬 통합 DB 및 rent 전용 DB 모두 갱신)
TARGET_DBS = [
    os.path.join(PROJECT_ROOT, "integrat.db"),
    os.path.join(PROJECT_ROOT, "data", "rent.db"),
    os.path.join(PROJECT_ROOT, "apps", "rent", "data", "rent.db")
]

def import_to_db(db_path: str, backup_data: dict):
    print(f"\n========================================================")
    print(f"🔄 데이터베이스 임포트 진행: {db_path}")
    print(f"========================================================")
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        data_block = backup_data.get("data", {})
        rooms_dict = data_block.get("rooms", {})
        expenses_list = data_block.get("expenses", [])
        histories_list = data_block.get("tenantHistories", [])

        branch_id = backup_data.get("branch_id", "main")
        branch_name = backup_data.get("branch_name", "시크빌 (29개실)")

        # 1. 지점(Branch) 갱신/생성
        b = session.query(RentBranch).filter(RentBranch.branch_id == branch_id).first()
        if not b:
            b = RentBranch(
                id=str(uuid.uuid4()),
                branch_id=branch_id,
                name=branch_name,
                contact_phone="010-1234-5678",
                address="서울특별시 관악구 신림로 (시크빌)",
                fee_plan="원룸 프리미엄 29실형",
                monthly_fee=150000,
                billing_status="PAID",
                is_active=True
            )
            session.add(b)
        else:
            b.name = branch_name

        # 기존 main 지점 데이터 초기화 (호실/수납/지출/이력)
        session.query(RentPayment).filter(RentPayment.branch_id == branch_id).delete(synchronize_session=False)
        session.query(RentRoom).filter(RentRoom.branch_id == branch_id).delete(synchronize_session=False)
        session.query(RentExpense).filter(RentExpense.branch_id == branch_id).delete(synchronize_session=False)
        session.query(RentTenantHistory).filter(RentTenantHistory.branch_id == branch_id).delete(synchronize_session=False)
        session.commit()

        # 2. 29개실 호실 및 수납 데이터 적재
        imported_rooms = 0
        imported_payments = 0

        for r_num_str, r_info in rooms_dict.items():
            r_num = int(r_num_str)
            r_obj = RentRoom(
                id=str(uuid.uuid4()),
                branch_id=branch_id,
                room_number=r_num,
                name=r_info.get("name", "") or "",
                id_number=r_info.get("id_number", "") or "",
                phone=r_info.get("phone", "") or "",
                lease_type=r_info.get("lease_type", "월세") or "월세",
                pay_timing=r_info.get("pay_timing", "후불") or "후불",
                deposit=int(r_info.get("deposit") or 0),
                rent=int(r_info.get("rent") or 0),
                maintenance=int(r_info.get("maintenance") or 0),
                clean_fee=int(r_info.get("clean_fee") or 0),
                move_in=r_info.get("move_in", "") or "",
                expiry=r_info.get("expiry", "") or "",
                move_out=r_info.get("move_out", "") or "",
                metadata_json=r_info.get("metadata_json", {})
            )
            session.add(r_obj)
            imported_rooms += 1

            # 수납 내역 (payments)
            payments_dict = r_info.get("payments", {})
            seen_month_year = set()

            for p_key, p_val in payments_dict.items():
                m = p_val.get("month")
                y = p_val.get("year", 2026)
                if not m or (y, m) in seen_month_year:
                    continue
                seen_month_year.add((y, m))

                pay_obj = RentPayment(
                    id=str(uuid.uuid4()),
                    branch_id=branch_id,
                    room_number=r_num,
                    year=y,
                    month=m,
                    paid=bool(p_val.get("paid", False)),
                    paid_date=p_val.get("paid_date", "") or "",
                    rent_amount=int(p_val.get("rent_amount") or 0),
                    maintenance_amount=int(p_val.get("maintenance_amount") or 0),
                    note=p_val.get("note", "") or "",
                    tenant_name=p_val.get("tenant_name", "") or r_obj.name,
                    tenant_id_number=p_val.get("tenant_id_number", "") or r_obj.id_number,
                    is_previous_tenant=bool(p_val.get("is_previous_tenant", False))
                )
                session.add(pay_obj)
                imported_payments += 1

        # 3. 지출(expenses) 데이터 적재
        imported_expenses = 0
        for exp in expenses_list:
            exp_obj = RentExpense(
                id=exp.get("id") or str(uuid.uuid4()),
                branch_id=branch_id,
                date=exp.get("date", "") or datetime.now().strftime("%Y-%m-%d"),
                item=exp.get("item", "") or "지출",
                amount=int(exp.get("amount") or 0),
                note=exp.get("note", "") or "",
                receipt_type=exp.get("receipt_type", "") or "",
                receipt_info=exp.get("receipt_info", "") or ""
            )
            session.add(exp_obj)
            imported_expenses += 1

        # 4. 전출자 이력(tenantHistories) 데이터 적재
        imported_histories = 0
        for th in histories_list:
            th_obj = RentTenantHistory(
                id=th.get("id") or str(uuid.uuid4()),
                branch_id=branch_id,
                room_number=int(th.get("room_number") or 101),
                name=th.get("name", "") or "",
                id_number=th.get("id_number", "") or "",
                phone=th.get("phone", "") or "",
                lease_type=th.get("lease_type", "월세") or "월세",
                pay_timing=th.get("pay_timing", "후불") or "후불",
                deposit=int(th.get("deposit") or 0),
                rent=int(th.get("rent") or 0),
                maintenance=int(th.get("maintenance") or 0),
                clean_fee=int(th.get("clean_fee") or 0),
                move_in=th.get("move_in", "") or "",
                expiry=th.get("expiry", "") or "",
                move_out=th.get("move_out", "") or "",
                retention_until=th.get("retention_until", "") or "",
                metadata_json=th.get("metadata_json", {})
            )
            session.add(th_obj)
            imported_histories += 1

        # 5. 관리자 계정 보장 (admin, chicvill)
        default_admins = [
            ("admin", "1212", "본사 총괄 최고관리자", "superadmin", None),
            ("chicvill", "1212", "시크빌 1호점 점주실장", "branch_admin", "main")
        ]
        for uname, pwd, rname, role, b_id in default_admins:
            u = session.query(RentUser).filter(RentUser.username == uname).first()
            if not u:
                u = RentUser(
                    id=str(uuid.uuid4()),
                    username=uname,
                    password=pwd,
                    name=rname,
                    phone="010-1234-5678",
                    role=role,
                    assigned_branch_id=b_id,
                    status="APPROVED",
                    reason="기본 관리자 계정"
                )
                session.add(u)
            else:
                u.password = pwd
                u.status = "APPROVED"

        session.commit()
        print(f"✅ 임포트 성공 완료!")
        print(f"  • 호실(Rooms): {imported_rooms}개실")
        print(f"  • 수납 장부(Payments): {imported_payments}건")
        print(f"  • 지출 내역(Expenses): {imported_expenses}건")
        print(f"  • 전출자 이력(Tenant Histories): {imported_histories}건")

    except Exception as e:
        session.rollback()
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()


def main():
    print(f"📖 시크빌 공식 전체 백업 데이터 파일 로드 중: {JSON_BACKUP_PATH}")
    with open(JSON_BACKUP_PATH, "r", encoding="utf-8") as f:
        backup_data = json.load(f)

    print(f"• 시스템: {backup_data.get('system')}")
    print(f"• 백업 일시: {backup_data.get('exported_at_formatted')}")
    print(f"• 대상 건물: {backup_data.get('branch_name')}")

    for db_path in TARGET_DBS:
        import_to_db(db_path, backup_data)

    print("\n🎉 모든 대상 데이터베이스에 시크빌 공식 실데이터 임포트가 완료되었습니다!")

if __name__ == "__main__":
    main()
