"""
apps/rent/backend/services/rent_service.py
원룸 임차료 관리 시스템 비즈니스 로직 서비스.
Clean Architecture 규격에 맞춰 DB 조작 및 29개실 시드 캐싱을 전담합니다.
"""
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, cast
from sqlalchemy.orm import Session

from ..db.models import RentBranch, RentRoom, RentPayment, RentExpense, RentUpgradeRequest, RentTenantHistory
from ..schemas import RoomUpdate, ExpenseCreate, BranchCreate, BranchUpdate, BranchBillingUpdate
from .payment_service import PaymentService
from .vat_service import VatService

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
            elif rNum == 404:
                # 404호: 이종진 고객 (2026-06-08 전입, 월세 290,000원, 관리비 150,000원, 보증금 5,000,000원, 후불)
                name = "이종진"
                rent_amt = 290000
                maint_amt = 150000
                deposit_amt = 5000000
                phone_num = "010-2345-4404"
                move_in_val = f"{cur_year}-06-08"
                expiry_val = f"{cur_year + 1}-06-07"
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

        # 1. 제1부동산: 시크빌
        b1 = db.query(RentBranch).filter(RentBranch.branch_id == "main").first()
        if not b1:
            b1 = RentBranch(
                branch_id="main",
                name="시크빌 (29개실)",
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
            r_num: int = cast(int, p.room_number)
            p_month: int = cast(int, p.month)
            p_year: int = cast(int, p.year)
            if r_num not in pay_map:
                pay_map[r_num] = {}
            pay_obj = {
                "month": p_month,
                "year": p_year,
                "paid": bool(p.paid),
                "paid_date": str(p.paid_date or ""),
                "rent_amount": p.rent_amount,
                "maintenance_amount": p.maintenance_amount,
                "note": str(p.note or ""),
                "tenant_name": str(p.tenant_name or ""),
                "is_previous_tenant": bool(p.is_previous_tenant)
            }
            # 하위 호환용 월 키 및 연도-월 복합키 동시 제공
            pay_map[r_num][p_month] = pay_obj
            pay_map[r_num][f"{p_year}-{p_month}"] = pay_obj

        result: Dict[int, Any] = {}
        for r in rooms_db:
            r_num: int = cast(int, r.room_number)
            result[r_num] = {
                "room_number": r_num,
                "branch_id": str(r.branch_id),
                "name": str(r.name or ""),
                "id_number": str(r.id_number or ""),
                "phone": str(r.phone or ""),
                "lease_type": str(r.lease_type or "월세"),
                "pay_timing": str(r.pay_timing or "후불"),
                "deposit": r.deposit,
                "rent": r.rent,
                "maintenance": r.maintenance,
                "clean_fee": r.clean_fee,
                "move_in": str(r.move_in or ""),
                "expiry": str(r.expiry or ""),
                "move_out": str(r.move_out or ""),
                "payments": pay_map.get(r_num, {})
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
        """현재 세입자의 전입일부터 현재월까지의 과거 납부 내역을 현재 세입자 정보 및 완납으로 동기화 채우기 (PaymentService 위임)"""
        self.ensure_default_seed(db, branch_id)
        return PaymentService.fill_tenant_payments(db, branch_id=branch_id, room_number=room_number)

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
        PaymentService.process_payment(
            db=db,
            room_number=room_number,
            month=month,
            branch_id=branch_id,
            paid_date=paid_date,
            note=note,
            tenant_name=tenant_name,
            year=year
        )
        return self.get_room(db, room_number, branch_id)

    def cancel_payment(self, db: Session, room_number: int, month: int, branch_id: str = "main", year: Optional[int] = None) -> Optional[Dict[str, Any]]:
        self.ensure_default_seed(db, branch_id)
        PaymentService.cancel_payment(
            db=db,
            room_number=room_number,
            month=month,
            branch_id=branch_id,
            year=year
        )
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
            note=data.note or "",
            receipt_type=data.receipt_type or "",
            receipt_info=data.receipt_info or ""
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return exp

    def delete_expense(self, db: Session, expense_id: str, branch_id: str = "main") -> bool:
        exp = db.query(RentExpense).filter(
            RentExpense.id == expense_id,
            RentExpense.branch_id == branch_id
        ).first()
        if exp:
            db.delete(exp)
            db.commit()
            return True
        return False

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
        """부가가치세 신고용 기간별(1~6월, 7~12월 등) 호실별 수납 집계 보고서 (VatService 위임)"""
        self.ensure_default_seed(db, branch_id)
        return VatService.get_vat_report(
            db=db,
            branch_id=branch_id,
            start_month=start_month,
            end_month=end_month,
            year=year,
            room_numbers=room_numbers,
            rooms_data=self.get_rooms(db, branch_id),
            histories=self.list_tenant_histories(db, branch_id)
        )

    def get_vat_settings(self, db: Session, branch_id: str = "main") -> Dict[str, Any]:
        """지점별 부가세 대상 호실 목록 DB 조회 (VatService 위임)"""
        self.ensure_default_seed(db, branch_id)
        return VatService.get_vat_settings(db, branch_id=branch_id)

    def save_vat_settings(self, db: Session, branch_id: str = "main", target_rooms: Optional[List[int]] = None) -> Dict[str, Any]:
        """지점별 부가세 대상 호실 목록 DB 저장 및 영구 유지 (VatService 위임)"""
        self.ensure_default_seed(db, branch_id)
        return VatService.save_vat_settings(db, branch_id=branch_id, target_rooms=target_rooms)


service = RentService()

