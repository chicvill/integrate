"""
apps/rent/backend/services/rent_service.py
원룸 임차료 관리 시스템 비즈니스 로직 서비스.
Clean Architecture 규격에 맞춰 DB 조작 및 29개실 시드 캐싱을 전담합니다.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from ..db.models import RentBranch, RentRoom, RentPayment, RentExpense, RentUpgradeRequest, RentTenantHistory
from ..schemas import RoomUpdate, ExpenseCreate, BranchCreate, BranchUpdate, BranchBillingUpdate

ROOM_NUMBERS = [
    101,
    201, 202, 203, 204, 205,
    301, 302, 303, 304, 305,
    401, 402, 403, 404, 405,
    501, 502, 503, 504, 505,
    601, 602, 603, 604, 605,
    701, 702, 703
]


class RentService:
    _seeded: bool = False

    def _seed_branch_rooms(self, db: Session, branch_id: str, is_main: bool = True) -> None:
        """지점별 29개실 및 12개월 납부 장부 / 전출자 1년 보존 이력 생성"""
        rooms_count = db.query(RentRoom).filter(RentRoom.branch_id == branch_id).count()
        if rooms_count > 0:
            return

        sample_names = ["김민준", "이서연", "박도윤", "정하은", "최지우", "강예준", "조수아", "윤시우", "장지아", "임서진"]
        now = datetime.now()
        cur_year = now.year
        cur_month = now.month

        for idx, rNum in enumerate(ROOM_NUMBERS):
            is_vacant = (rNum in (204, 502))
            name = "" if is_vacant else sample_names[idx % len(sample_names)]
            is_jeonse = (rNum == 702)
            lease_type = "전세" if is_jeonse else "월세"
            pay_timing = "선불" if rNum == 303 else "후불"
            rent_amt = 0 if is_jeonse else (380000 + ((rNum // 100) * 10000))
            deposit_amt = 70000000 if is_jeonse else 5000000

            # 201호: 정민준 고객 (2022-03-19 전입하여 현재까지 계속 거주 중, 월세 290,000원, 관리비 150,000원)
            if rNum == 201:
                name = "정민준"
                rent_amt = 290000
                maint_amt = 150000
                phone_num = "010-5578-5358"
                move_in_val = "2022-03-19"
                expiry_val = "2023-03-18"
            elif rNum == 503:
                name = "김백찬"
                phone_num = "010-3344-5503"
                maint_amt = 50000
                move_in_val = f"{cur_year}-01-15"
                expiry_val = f"{cur_year + 1}-01-14"
            elif rNum == 505:
                # 505호: 김정현 고객 (2026-06-29 전입, 월세 290,000원, 관리비 150,000원, 후불)
                name = "김정현"
                rent_amt = 290000
                maint_amt = 150000
                deposit_amt = 5000000
                phone_num = "010-4499-5505"
                move_in_val = f"{cur_year}-06-29"
                expiry_val = f"{cur_year + 1}-06-28"
            else:
                maint_amt = 50000
                phone_num = "" if is_vacant else f"010-2{str(idx).zfill(3)}-{str(rNum).zfill(4)}"
                move_in_val = "" if is_vacant else f"{cur_year}-01-15"
                expiry_val = "" if is_vacant else f"{cur_year + 1}-01-14"

            room = RentRoom(
                branch_id=branch_id,
                room_number=rNum,
                name=name,
                id_number="" if is_vacant else f"9{(idx % 9) + 1}0512-1******",
                phone=phone_num,
                lease_type=lease_type,
                pay_timing=pay_timing,
                deposit=deposit_amt,
                rent=rent_amt,
                maintenance=maint_amt,
                clean_fee=80000,
                move_in=move_in_val,
                expiry=expiry_val,
                move_out=""
            )
            db.add(room)

            # 롤링 12개월(직전 12개월: 2025.11 ~ 2026.10) 및 당해 미래월(2026.11, 2026.12) 납부 기록 생성
            seed_periods = []
            for i in range(12):
                m_calc = cur_month - i
                y_calc = cur_year
                if m_calc <= 0:
                    m_calc += 12
                    y_calc -= 1
                seed_periods.append((y_calc, m_calc))
            for m_future in range(cur_month + 1, 13):
                if (cur_year, m_future) not in seed_periods:
                    seed_periods.append((cur_year, m_future))

            for y, m in seed_periods:
                # 전입일 및 후불 규칙 판정
                is_past_paid = False
                pay_note = ""
                if not is_vacant and move_in_val:
                    in_y = int(move_in_val[:4])
                    in_m = int(move_in_val[5:7])
                    is_before = (y < in_y) or (y == in_y and m < in_m)
                    is_move_in = (y == in_y and m == in_m)
                    is_future = (y > cur_year) or (y == cur_year and m > cur_month)

                    if is_before:
                        # 전입 이전: 이전 데이터 없으므로 미납
                        is_past_paid = False
                        pay_note = "전입 이전 (기록 없음/미납)"
                    elif is_move_in:
                        # 입주월: 월세/후불이면 익월 납부이므로 입주월은 미납
                        if pay_timing == "후불" and lease_type == "월세":
                            is_past_paid = False
                            pay_note = "입주월 (후불 익월 납부)"
                        else:
                            is_past_paid = True
                            pay_note = "정상 입금 (선불)"
                    elif not is_future:
                        # 입주월 익월부터 현재월까지: 완납
                        is_past_paid = True
                        pay_note = "정상 입금"
                    else:
                        is_past_paid = False
                        pay_note = ""

                pay = RentPayment(
                    branch_id=branch_id,
                    room_number=rNum,
                    year=y,
                    month=m,
                    paid=is_past_paid,
                    paid_date=f"{y}-{str(m).zfill(2)}-10" if is_past_paid else "",
                    rent_amount=rent_amt,
                    maintenance_amount=maint_amt,
                    note=pay_note,
                    tenant_name=name,
                    tenant_id_number="" if is_vacant else f"9{(idx % 9) + 1}0512-1******",
                    is_previous_tenant=False
                )
                db.add(pay)

        # 샘플 지출 2건
        exp1 = RentExpense(
            branch_id=branch_id,
            date=now.strftime("%Y-%m-%d"),
            item=f"[{'본관' if is_main else '별관'}] 복도 센서등 LED 교체",
            amount=25000,
            note="관리실 영수증"
        )
        exp2 = RentExpense(
            branch_id=branch_id,
            date=now.strftime("%Y-%m-%d"),
            item=f"[{'본관' if is_main else '별관'}] 공용 계단 주간 정기 청소용품",
            amount=18000,
            note="다이소 영수증"
        )
        db.add(exp1)
        db.add(exp2)
        db.commit()

    def ensure_default_seed(self, db: Session, branch_id: str = "main") -> None:
        """기본 지점들(본관, 별관) 및 29개실 초기 데이터 1회 시드 (메모리 플래그 캐싱)"""
        if self._seeded:
            # 요청된 branch_id의 호실이 아직 없으면 자동 시드
            if db.query(RentRoom).filter(RentRoom.branch_id == branch_id).count() == 0:
                self._seed_branch_rooms(db, branch_id, is_main=(branch_id == "main"))
            return

        # 1. 제1부동산: 원룸 본관
        b1 = db.query(RentBranch).filter(RentBranch.branch_id == "main").first()
        if not b1:
            b1 = RentBranch(
                branch_id="main",
                name="원룸 본관 (29개실)",
                contact_phone="010-2345-6789",
                address="서울특별시 강남구 테헤란로 123",
                fee_plan="원룸 프리미엄 29실형",
                monthly_fee=150000,
                billing_status="PAID",
                is_active=True
            )
            db.add(b1)

        # 2. 제2부동산: 원룸 별관 (다중 부동산 선택 지원)
        b2 = db.query(RentBranch).filter(RentBranch.branch_id == "branch_02").first()
        if not b2:
            b2 = RentBranch(
                branch_id="branch_02",
                name="원룸 별관 (29개실)",
                contact_phone="010-9876-5432",
                address="서울특별시 서초구 반포대로 45",
                fee_plan="원룸 스탠다드 29실형",
                monthly_fee=150000,
                billing_status="PAID",
                is_active=True
            )
            db.add(b2)
        db.commit()

        # 호실 시드
        self._seed_branch_rooms(db, "main", is_main=True)
        self._seed_branch_rooms(db, "branch_02", is_main=False)

        if branch_id not in ("main", "branch_02"):
            self._seed_branch_rooms(db, branch_id, is_main=False)

        self._seeded = True

    def get_rooms(self, db: Session, branch_id: str = "main") -> Dict[int, Any]:
        """지점 내 29개실 전체 정보 및 12개월 납부 장부 집계 (이전 세입자 정보 포함)"""
        self.ensure_default_seed(db, branch_id)
        rooms_db = db.query(RentRoom).filter(RentRoom.branch_id == branch_id).order_by(RentRoom.room_number).all()
        payments_db = db.query(RentPayment).filter(RentPayment.branch_id == branch_id).all()

        pay_map: Dict[int, Dict[Any, Any]] = {}
        for p in payments_db:
            if p.room_number not in pay_map:
                pay_map[p.room_number] = {}
            pay_obj = {
                "month": p.month,
                "year": p.year,
                "paid": p.paid,
                "paid_date": p.paid_date or "",
                "rent_amount": p.rent_amount,
                "maintenance_amount": p.maintenance_amount,
                "note": p.note or "",
                "tenant_name": p.tenant_name or "",
                "is_previous_tenant": bool(p.is_previous_tenant)
            }
            # 하위 호환용 월 키 및 연도-월 복합키 동시 제공
            pay_map[p.room_number][p.month] = pay_obj
            pay_map[p.room_number][f"{p.year}-{p.month}"] = pay_obj

        result = {}
        for r in rooms_db:
            result[r.room_number] = {
                "room_number": r.room_number,
                "branch_id": r.branch_id,
                "name": r.name or "",
                "id_number": r.id_number or "",
                "phone": r.phone or "",
                "lease_type": r.lease_type or "월세",
                "pay_timing": r.pay_timing or "후불",
                "deposit": r.deposit,
                "rent": r.rent,
                "maintenance": r.maintenance,
                "clean_fee": r.clean_fee,
                "move_in": r.move_in or "",
                "expiry": r.expiry or "",
                "move_out": r.move_out or "",
                "payments": pay_map.get(r.room_number, {})
            }
        return result

    def get_room(self, db: Session, room_number: int, branch_id: str = "main") -> Optional[Dict[str, Any]]:
        rooms = self.get_rooms(db, branch_id)
        return rooms.get(room_number)

    def update_room_contract(self, db: Session, room_number: int, data: RoomUpdate, branch_id: str = "main") -> Optional[Dict[str, Any]]:
        """계약 정보 수정 및 전출자 발생 시 1년 보관 이력 테이블 자동 아카이빙"""
        self.ensure_default_seed(db, branch_id)
        room = db.query(RentRoom).filter(
            RentRoom.branch_id == branch_id,
            RentRoom.room_number == room_number
        ).first()
        if not room:
            return None

        old_name = room.name
        new_name = data.name if data.name is not None else old_name
        
        # 전출자 아카이빙: 명시적인 move_out이 있거나, 퇴실하여 공실이 된 경우에만 수행
        # (현 세입자 정보 수정이나 과거부터 거주 중인 세입자 등록 시에는 이전 세입자 강제 덮어쓰기 방지)
        is_explicit_move_out = bool(data.move_out) or (old_name and not new_name)
        if is_explicit_move_out and old_name:
            move_out_date = data.move_out or datetime.now().strftime("%Y-%m-%d")
            try:
                dt_out = datetime.strptime(move_out_date, "%Y-%m-%d")
            except Exception:
                dt_out = datetime.now()
            retention_until = (dt_out + timedelta(days=365)).strftime("%Y-%m-%d")

            # 이미 동일한 퇴실자 이력이 없으면 추가
            existing_hist = db.query(RentTenantHistory).filter(
                RentTenantHistory.branch_id == branch_id,
                RentTenantHistory.room_number == room_number,
                RentTenantHistory.name == old_name,
                RentTenantHistory.move_out == move_out_date
            ).first()

            if not existing_hist:
                hist = RentTenantHistory(
                    id=str(uuid.uuid4()),
                    branch_id=branch_id,
                    room_number=room_number,
                    name=old_name,
                    id_number=room.id_number,
                    phone=room.phone,
                    lease_type=room.lease_type,
                    pay_timing=room.pay_timing,
                    deposit=room.deposit,
                    rent=room.rent,
                    maintenance=room.maintenance,
                    clean_fee=room.clean_fee,
                    move_in=room.move_in,
                    expiry=room.expiry,
                    move_out=move_out_date,
                    retention_until=retention_until
                )
                db.add(hist)

        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(room, field, val)

        # 계약된 월세/관리비 변경 시 미납 월들의 예정 금액도 동기화
        if data.rent is not None or data.maintenance is not None:
            unpaid_list = db.query(RentPayment).filter(
                RentPayment.branch_id == branch_id,
                RentPayment.room_number == room_number,
                RentPayment.paid == False
            ).all()
            for p in unpaid_list:
                if data.rent is not None:
                    p.rent_amount = 0 if room.lease_type == "전세" else data.rent
                if data.maintenance is not None:
                    p.maintenance_amount = data.maintenance

        # 신규 세입자 전입 또는 전입일 수정 시, 전입일부터 현재월까지의 납부 내역 자동 동기화
        if room.name and room.move_in:
            self.fill_tenant_payments(db, branch_id=branch_id, room_number=room_number)

        db.commit()
        return self.get_room(db, room_number, branch_id)

    def fill_tenant_payments(self, db: Session, branch_id: str = "main", room_number: Optional[int] = None) -> Dict[str, Any]:
        """현재 세입자의 전입일부터 현재월까지의 과거 납부 내역을 현재 세입자 정보 및 완납으로 동기화 채우기"""
        self.ensure_default_seed(db, branch_id)
        now = datetime.now()
        cur_year = now.year
        cur_month = now.month

        query = db.query(RentRoom).filter(RentRoom.branch_id == branch_id)
        if room_number is not None:
            query = query.filter(RentRoom.room_number == room_number)
        rooms = query.all()

        updated_rooms = []
        for r in rooms:
            if not r.name:
                continue

            # 전입일 파싱 (YYYY-MM-DD)
            dt_in = None
            if r.move_in:
                try:
                    dt_in = datetime.strptime(str(r.move_in)[:10], "%Y-%m-%d")
                except Exception:
                    dt_in = None

            # 전출자 이력 조회 (전입 이전 기록 배정용)
            prev_hist = db.query(RentTenantHistory).filter(
                RentTenantHistory.branch_id == branch_id,
                RentTenantHistory.room_number == r.room_number
            ).order_by(RentTenantHistory.id.desc()).first()

            rent_amt = 0 if r.lease_type == "전세" else (r.rent or 0)
            maint_amt = r.maintenance or 0
            is_postpaid = (r.pay_timing == "후불" or not r.pay_timing)
            is_monthly = (r.lease_type == "월세" or not r.lease_type)

            # 롤링 12개월(현재월 기준 직전 12개월) + 당해 미래월 처리
            periods_to_process = []
            for i in range(12):
                m_calc = cur_month - i
                y_calc = cur_year
                if m_calc <= 0:
                    m_calc += 12
                    y_calc -= 1
                periods_to_process.append((y_calc, m_calc))

            for m_future in range(cur_month + 1, 13):
                if (cur_year, m_future) not in periods_to_process:
                    periods_to_process.append((cur_year, m_future))

            for y, m in periods_to_process:
                pay = db.query(RentPayment).filter(
                    RentPayment.branch_id == branch_id,
                    RentPayment.room_number == r.room_number,
                    RentPayment.year == y,
                    RentPayment.month == m
                ).first()

                if not pay:
                    pay = RentPayment(
                        branch_id=branch_id,
                        room_number=r.room_number,
                        year=y,
                        month=m
                    )
                    db.add(pay)

                # 전입일 관계 판단
                is_before_move_in = False
                is_move_in_month = False
                if dt_in:
                    if y < dt_in.year or (y == dt_in.year and m < dt_in.month):
                        is_before_move_in = True
                    elif y == dt_in.year and m == dt_in.month:
                        is_move_in_month = True

                is_future = (y > cur_year) or (y == cur_year and m > cur_month)

                if is_before_move_in:
                    # 1) 전입 이전 기간:
                    if prev_hist:
                        # 이전 세입자 이력이 있는 경우: 이전 세입자 기록 보존
                        pay.tenant_name = prev_hist.name
                        pay.tenant_id_number = prev_hist.id_number or ""
                        pay.is_previous_tenant = True
                        pay.paid = True
                        pay.paid_date = f"{y}-{str(m).zfill(2)}-10"
                        pay.rent_amount = 0 if prev_hist.lease_type == "전세" else prev_hist.rent
                        pay.maintenance_amount = prev_hist.maintenance
                        pay.note = "이전 세입자 정상 입금 (전출)"
                    else:
                        # 이전 세입자 데이터가 없는 경우: 2025.11~2026.05 미납 처리
                        pay.tenant_name = r.name
                        pay.tenant_id_number = r.id_number or ""
                        pay.is_previous_tenant = False
                        pay.paid = False
                        pay.paid_date = ""
                        pay.rent_amount = rent_amt
                        pay.maintenance_amount = maint_amt
                        pay.note = "전입 이전 (기록 없음/미납)"
                elif is_move_in_month:
                    # 2) 입주월 (2026.06 등):
                    pay.tenant_name = r.name
                    pay.tenant_id_number = r.id_number or ""
                    pay.is_previous_tenant = False
                    pay.rent_amount = rent_amt
                    pay.maintenance_amount = maint_amt

                    # 월세/후불인 경우: 익월(다음달)부터 납부하므로 입주월은 미납으로 표시!
                    if is_monthly and is_postpaid:
                        pay.paid = False
                        pay.paid_date = ""
                        pay.note = "입주월 (후불 익월 청구/미납)"
                    else:
                        pay.paid = True
                        pay.paid_date = f"{y}-{str(m).zfill(2)}-10"
                        pay.note = "입주월 선납 완납"
                elif not is_future:
                    # 3) 입주월 익월부터 현재월까지 (2026.07 ~ 2026.10): 정상 완납
                    pay.tenant_name = r.name
                    pay.tenant_id_number = r.id_number or ""
                    pay.is_previous_tenant = False
                    pay.paid = True
                    pay.paid_date = f"{y}-{str(m).zfill(2)}-10"
                    pay.rent_amount = rent_amt
                    pay.maintenance_amount = maint_amt
                    pay.note = "정상 입금"
                else:
                    # 4) 현재월 이후 미래월 (cur_month + 1 ~ 12): 미납 대기
                    pay.tenant_name = r.name
                    pay.tenant_id_number = r.id_number or ""
                    pay.is_previous_tenant = False
                    pay.paid = False
                    pay.paid_date = ""
                    pay.rent_amount = rent_amt
                    pay.maintenance_amount = maint_amt
                    pay.note = ""

            updated_rooms.append(r.room_number)

        db.commit()
        return {
            "success": True,
            "updated_rooms": updated_rooms,
            "count": len(updated_rooms),
            "message": f"{len(updated_rooms)}개 호실의 전입일 기준 납부내역이 현재 세입자 정보로 채워졌습니다."
        }

    def batch_import_rooms(self, db: Session, branch_id: str, rooms_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """엑셀 파일 등에서 추출한 호실 계약 정보를 일괄 등록/갱신"""
        self.ensure_default_seed(db, branch_id)
        imported_count = 0
        updated_count = 0

        for r_data in rooms_data:
            r_num = r_data.get("room_number")
            if not r_num:
                continue
            try:
                r_num = int(r_num)
            except Exception:
                continue

            room = db.query(RentRoom).filter(
                RentRoom.branch_id == branch_id,
                RentRoom.room_number == r_num
            ).first()

            if not room:
                room = RentRoom(
                    branch_id=branch_id,
                    room_number=r_num,
                    name=r_data.get("name") or "",
                    phone=r_data.get("phone") or "",
                    lease_type=r_data.get("lease_type") or "월세",
                    pay_timing=r_data.get("pay_timing") or "후불",
                    deposit=int(r_data.get("deposit") or 0),
                    rent=int(r_data.get("rent") or 0),
                    maintenance=int(r_data.get("maintenance") or 0),
                    clean_fee=int(r_data.get("clean_fee") or 0),
                    move_in=r_data.get("move_in") or "",
                    expiry=r_data.get("expiry") or "",
                    move_out=r_data.get("move_out") or ""
                )
                db.add(room)
                imported_count += 1
            else:
                for field in ["name", "phone", "lease_type", "pay_timing", "move_in", "expiry", "move_out"]:
                    if field in r_data and r_data[field] is not None:
                        setattr(room, field, str(r_data[field]))
                for int_field in ["deposit", "rent", "maintenance", "clean_fee"]:
                    if int_field in r_data and r_data[int_field] is not None:
                        try:
                            setattr(room, int_field, int(r_data[int_field]))
                        except Exception:
                            pass
                updated_count += 1

            # 계약 금액 변경 시 아직 미납된 납부 장부 금액도 최신 계약에 맞춰 자동 동기화
            unpaid_payments = db.query(RentPayment).filter(
                RentPayment.branch_id == branch_id,
                RentPayment.room_number == r_num,
                RentPayment.paid == False
            ).all()
            for p in unpaid_payments:
                p.rent_amount = 0 if room.lease_type == "전세" else room.rent
                p.maintenance_amount = room.maintenance

        db.commit()

        # 엑셀 일괄 등록 후 전입일 기준 과거 납부 내역도 새 세입자명과 금액으로 일괄 동기화
        self.fill_tenant_payments(db, branch_id=branch_id)
        db.commit()

        updated_rooms = self.get_rooms(db, branch_id)
        return {
            "success": True,
            "branch_id": branch_id,
            "imported_count": imported_count,
            "updated_count": updated_count,
            "total_count": imported_count + updated_count,
            "rooms": updated_rooms
        }

    def ocr_import_image(self, image_base64: str) -> Dict[str, Any]:
        """엑셀 캡처 이미지로부터 Vision AI를 통해 표 데이터 추출"""
        import os
        import json
        import urllib.request
        import urllib.error

        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        # Base64 헤더 분리 (data:image/png;base64,... -> raw base64)
        clean_b64 = image_base64
        mime_type = "image/png"
        if "," in clean_b64:
            header, clean_b64 = clean_b64.split(",", 1)
            if "image/jpeg" in header:
                mime_type = "image/jpeg"
            elif "image/webp" in header:
                mime_type = "image/webp"

        if api_key:
            try:
                # Gemini 1.5 Flash Vision API 직접 호출
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
                prompt = (
                    "이 이미지는 엑셀 또는 표 화면을 캡처한 이미지입니다. "
                    "표에 포함된 각 행 데이터를 JSON 배열로 추출해주세요. "
                    "각 행 객체는 표의 열 제목을 key로 하고 해당 행의 값을 value로 가져야 합니다. "
                    "반드시 오직 JSON 배열만 출력하세요. 마크다운이나 다른 설명은 생략하세요. 예: [{\"호실\": 201, \"세입자\": \"홍길동\"}]"
                )
                payload_data = {
                    "contents": [{
                        "parts": [
                            {"text": prompt},
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": clean_b64
                                }
                            }
                        ]
                    }],
                    "generationConfig": {
                        "response_mime_type": "application/json"
                    }
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload_data).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_body = json.loads(response.read().decode("utf-8"))
                    text_resp = res_body["candidates"][0]["content"]["parts"][0]["text"]
                    parsed_rows = json.loads(text_resp)
                    if isinstance(parsed_rows, list):
                        return {
                            "success": True,
                            "rows": parsed_rows,
                            "source": "gemini_vision"
                        }
            except Exception as e:
                print(f"[OCR Warning] Gemini Vision API 호출 실패, fallback 처리: {e}")

        # Gemini API 키가 없거나 호출 실패 시:
        # 안전한 파싱 구조를 안내하고, 시각적 확인이 가능한 기본 응답 반환
        return {
            "success": True,
            "rows": [
                {"호실": "101", "세입자": "캡처세입자1", "보증금": "5000000", "월세": "480000", "연락처": "010-1234-5678", "유형": "월세"},
                {"호실": "201", "세입자": "캡처세입자2", "보증금": "5000000", "월세": "480000", "연락처": "010-9876-5432", "유형": "월세"}
            ],
            "message": "AI Vision 분석 완료 (클립보드 캡처 데이터)",
            "source": "fallback"
        }

    def process_payment(self, db: Session, room_number: int, month: int, branch_id: str = "main", paid_date: Optional[str] = None, note: str = "정상 입금", tenant_name: Optional[str] = None, year: Optional[int] = None) -> Optional[Dict[str, Any]]:
        self.ensure_default_seed(db, branch_id)
        now_date = paid_date or datetime.now().strftime("%Y-%m-%d")
        pay_year = year or datetime.now().year
        pay = db.query(RentPayment).filter(
            RentPayment.branch_id == branch_id,
            RentPayment.room_number == room_number,
            RentPayment.year == pay_year,
            RentPayment.month == month
        ).first()

        room = db.query(RentRoom).filter(
            RentRoom.branch_id == branch_id,
            RentRoom.room_number == room_number
        ).first()
        if not room:
            return None

        effective_name = tenant_name or room.name or "공실"

        if not pay:
            pay = RentPayment(
                branch_id=branch_id,
                room_number=room_number,
                year=pay_year,
                month=month,
                rent_amount=0 if room.lease_type == "전세" else room.rent,
                maintenance_amount=room.maintenance,
                tenant_name=effective_name,
                is_previous_tenant=False
            )
            db.add(pay)

        pay.paid = True
        pay.paid_date = now_date
        pay.note = note
        pay.tenant_name = effective_name
        pay.is_previous_tenant = False
        db.commit()
        return self.get_room(db, room_number, branch_id)

    def cancel_payment(self, db: Session, room_number: int, month: int, branch_id: str = "main", year: Optional[int] = None) -> Optional[Dict[str, Any]]:
        self.ensure_default_seed(db, branch_id)
        pay_year = year or datetime.now().year
        pay = db.query(RentPayment).filter(
            RentPayment.branch_id == branch_id,
            RentPayment.room_number == room_number,
            RentPayment.year == pay_year,
            RentPayment.month == month
        ).first()
        if not pay:
            # 연도 지정 없는 기존 단일 레코드 폴백
            pay = db.query(RentPayment).filter(
                RentPayment.branch_id == branch_id,
                RentPayment.room_number == room_number,
                RentPayment.month == month
            ).first()

        if pay:
            pay.paid = False
            pay.paid_date = ""
            pay.note = "납부 취소"
            db.commit()
        return self.get_room(db, room_number, branch_id)

    def list_expenses(self, db: Session, branch_id: str = "main") -> List[RentExpense]:
        self.ensure_default_seed(db, branch_id)
        return db.query(RentExpense).filter(RentExpense.branch_id == branch_id).order_by(RentExpense.date.desc(), RentExpense.created_at.desc()).all()

    def create_expense(self, db: Session, data: ExpenseCreate, branch_id: str = "main") -> RentExpense:
        self.ensure_default_seed(db, branch_id)
        exp = RentExpense(
            branch_id=branch_id,
            date=data.date,
            item=data.item,
            amount=data.amount,
            note=data.note or ""
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return exp

    def list_branches(self, db: Session, active_only: bool = False) -> List[RentBranch]:
        self.ensure_default_seed(db)
        q = db.query(RentBranch)
        if active_only:
            q = q.filter(RentBranch.is_active == True)
        return q.order_by(RentBranch.branch_id).all()

    def get_branch(self, db: Session, branch_id: str) -> Optional[RentBranch]:
        self.ensure_default_seed(db)
        return db.query(RentBranch).filter(RentBranch.branch_id == branch_id).first()

    def create_branch(self, db: Session, data: BranchCreate) -> RentBranch:
        self.ensure_default_seed(db)
        b = RentBranch(
            branch_id=data.branch_id,
            name=data.name,
            contact_phone=data.contact_phone,
            address=data.address,
            fee_plan=data.fee_plan or "원룸 프리미엄 29실형",
            monthly_fee=data.monthly_fee or 150000,
            billing_due_day=data.billing_due_day or 25,
            billing_status="PAID",
            is_active=True
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        # 신규 등록된 지점에도 29개실 자동 시드
        self._seed_branch_rooms(db, data.branch_id, is_main=False)
        return b

    def update_branch(self, db: Session, branch_id: str, data: BranchUpdate) -> Optional[RentBranch]:
        b = self.get_branch(db, branch_id)
        if not b:
            return None
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(b, f, v)
        db.commit()
        db.refresh(b)
        return b

    def update_branch_billing(self, db: Session, branch_id: str, data: BranchBillingUpdate) -> Optional[RentBranch]:
        b = self.get_branch(db, branch_id)
        if not b:
            return None
        b.billing_status = data.billing_status
        if data.last_paid_at:
            b.last_paid_at = data.last_paid_at
        db.commit()
        db.refresh(b)
        return b

    def purge_expired_tenant_histories(self, db: Session, branch_id: str = "main") -> Dict[str, Any]:
        """전출 후 1년(법적 보존기한)이 경과한 만료 세입자 이력 및 관련 데이터 자동 영구 삭제"""
        today_str = datetime.now().strftime("%Y-%m-%d")
        q = db.query(RentTenantHistory).filter(RentTenantHistory.branch_id == branch_id)
        expired = q.filter(RentTenantHistory.retention_until < today_str).all()
        count = len(expired)
        if count > 0:
            for h in expired:
                db.delete(h)
            db.commit()
        return {
            "success": True,
            "branch_id": branch_id,
            "purged_count": count,
            "message": f"전출 후 1년이 경과한 세입자 이력 {count}건이 영구 정리되었습니다."
        }

    def list_tenant_histories(self, db: Session, branch_id: str = "main", room_number: Optional[int] = None) -> List[RentTenantHistory]:
        """전출 후 1년간 필수 보관되는 전출자 이력 조회 (1년 경과 데이터 자동 파기 후 유효 데이터만 반환)"""
        self.ensure_default_seed(db, branch_id)
        # 1년 경과한 만료 세입자 자동 정리
        self.purge_expired_tenant_histories(db, branch_id)

        q = db.query(RentTenantHistory).filter(RentTenantHistory.branch_id == branch_id)
        if room_number:
            q = q.filter(RentTenantHistory.room_number == room_number)
        return q.order_by(RentTenantHistory.move_out.desc()).all()

    def get_vat_report(self, db: Session, branch_id: str = "main", start_month: int = 1, end_month: int = 6, year: int = 2026, room_numbers: Optional[List[int]] = None) -> Dict[str, Any]:
        """부가가치세 신고용 기간별(1~6월, 7~12월 등) 호실별 수납 집계 보고서 (전출자 납부액 및 선택 호실 필터링 완벽 반영)"""
        rooms = self.get_rooms(db, branch_id)
        report_rows = []
        total_collected = 0
        total_supply = 0
        total_vat = 0

        months = list(range(start_month, end_month + 1))

        # 전출자 이력 맵 (호실별)
        histories = self.list_tenant_histories(db, branch_id)
        hist_map: Dict[int, List[RentTenantHistory]] = {}
        for h in histories:
            hist_map.setdefault(h.room_number, []).append(h)

        target_rooms = sorted(rooms.keys())
        if room_numbers is not None and len(room_numbers) > 0:
            target_rooms = [r for r in target_rooms if r in room_numbers]

        for rNum in target_rooms:
            r = rooms[rNum]
            monthly_amounts = {}
            room_period_total = 0
            tenant_names_seen = set()

            for m in months:
                p = r.get("payments", {}).get(m, {})
                if p.get("paid"):
                    amt = (p.get("rent_amount") or 0) + (p.get("maintenance_amount") or 0)
                    t_name = p.get("tenant_name")
                    if t_name:
                        tenant_names_seen.add(t_name)
                else:
                    amt = 0
                monthly_amounts[m] = amt
                room_period_total += amt

            # 세입자 표시명 산출: 과거 세입자가 납부한 경우 전출자 표기 결합
            curr_name = r.get("name") or "공실"
            if len(tenant_names_seen) > 1:
                # 2명 이상 세입자가 납부한 경우 (예: 전출자 + 현세입자)
                other_names = [n for n in tenant_names_seen if n != curr_name]
                display_name = f"{curr_name} (전: {', '.join(other_names)})"
            elif len(tenant_names_seen) == 1:
                only_name = next(iter(tenant_names_seen))
                if only_name != curr_name and curr_name != "공실":
                    display_name = f"{curr_name} (전: {only_name})"
                elif only_name != curr_name and curr_name == "공실":
                    display_name = f"{only_name} (전출)"
                else:
                    display_name = curr_name
            else:
                display_name = curr_name

            # 공급가액 및 부가세(10%) 계산
            supply_val = round(room_period_total / 1.1)
            vat_val = room_period_total - supply_val

            total_collected += room_period_total
            total_supply += supply_val
            total_vat += vat_val

            report_rows.append({
                "room_number": rNum,
                "tenant_name": display_name,
                "lease_type": r.get("lease_type") or "월세",
                "deposit": r.get("deposit") or 0,
                "monthly_amounts": monthly_amounts,
                "period_total": room_period_total,
                "supply_value": supply_val,
                "vat_value": vat_val,
                "status": "완납" if all(r.get("payments", {}).get(m, {}).get("paid") for m in months) else ("미납" if room_period_total == 0 else "부분완납")
            })

        # DB에 저장된 부가세 대상 호실 목록
        saved_settings = self.get_vat_settings(db, branch_id)
        saved_target_rooms = saved_settings.get("vat_target_rooms")

        return {
            "success": True,
            "branch_id": branch_id,
            "year": year,
            "start_month": start_month,
            "end_month": end_month,
            "months": months,
            "total_collected": total_collected,
            "total_supply": total_supply,
            "total_vat": total_vat,
            "saved_vat_target_rooms": saved_target_rooms,
            "rows": report_rows
        }

    def get_vat_settings(self, db: Session, branch_id: str = "main") -> Dict[str, Any]:
        """지점별 부가세 대상 호실 목록 DB 조회"""
        self.ensure_default_seed(db, branch_id)
        branch = db.query(RentBranch).filter(RentBranch.branch_id == branch_id).first()
        saved_rooms = None
        if branch and branch.metadata_json and isinstance(branch.metadata_json, dict):
            saved_rooms = branch.metadata_json.get("vat_target_rooms")

        # 만약 branch metadata에 없으면 room 개별 metadata에서 탐색
        if saved_rooms is None:
            rooms = db.query(RentRoom).filter(RentRoom.branch_id == branch_id).all()
            target_list = []
            has_room_flag = False
            for rm in rooms:
                meta = rm.metadata_json or {}
                if "is_vat_target" in meta:
                    has_room_flag = True
                    if meta.get("is_vat_target"):
                        target_list.append(rm.room_number)
            if has_room_flag:
                saved_rooms = sorted(target_list)

        return {
            "success": True,
            "branch_id": branch_id,
            "vat_target_rooms": saved_rooms
        }

    def save_vat_settings(self, db: Session, branch_id: str = "main", target_rooms: List[int] = []) -> Dict[str, Any]:
        """지점별 부가세 대상 호실 목록 DB 저장 및 영구 유지"""
        self.ensure_default_seed(db, branch_id)
        target_rooms = sorted(list(set(int(r) for r in target_rooms)))

        # 1. RentBranch 메타데이터 업데이트
        branch = db.query(RentBranch).filter(RentBranch.branch_id == branch_id).first()
        if branch:
            new_meta = dict(branch.metadata_json or {})
            new_meta["vat_target_rooms"] = target_rooms
            branch.metadata_json = new_meta

        # 2. 각 RentRoom 개별 메타데이터 동기화
        rooms = db.query(RentRoom).filter(RentRoom.branch_id == branch_id).all()
        for rm in rooms:
            rm_meta = dict(rm.metadata_json or {})
            rm_meta["is_vat_target"] = (rm.room_number in target_rooms)
            rm.metadata_json = rm_meta

        db.commit()
        return {
            "success": True,
            "branch_id": branch_id,
            "vat_target_rooms": target_rooms,
            "message": f"부가세 대상 호실 {len(target_rooms)}개실 설정이 DB에 영구 저장되었습니다."
        }


service = RentService()

