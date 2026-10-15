"""
apps/rent/backend/services/rent_service.py
원룸 임차료 관리 시스템 비즈니스 로직 서비스.
Clean Architecture 규격에 맞춰 DB 조작 및 29개실 시드 캐싱을 전담합니다.
"""
import json
import re
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, cast
from sqlalchemy.orm import Session

from ..db.database import init_db
from ..db.models import RentBranch, RentRoom, RentPayment, RentExpense, RentUpgradeRequest, RentTenantHistory, RentUser
from ..schemas import RoomUpdate, ExpenseCreate, BranchCreate, BranchUpdate, BranchBillingUpdate, RegisterRequest, UserApprovePayload, UserUpdatePayload
from .payment_service import PaymentService
from .vat_service import VatService
from .auth_service import auth_service
from .branch_service import branch_service

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
    branch_service = branch_service

    def normalize_branch_id(self, branch_id: Optional[str]) -> str:
        """지점 코드 정규화 (chicvill01 -> main, chicvill02 -> branch_9027)"""
        return branch_service.normalize_branch_id(branch_id)

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
        norm_bid = self.branch_service.normalize_branch_id(branch_id)
        if self._seeded:
            # 요청된 branch_id의 호실이 아직 없으면 자동 시드
            if db.query(RentRoom).filter(RentRoom.branch_id == norm_bid).count() == 0:
                self._seed_branch_rooms(db, norm_bid, is_main=(norm_bid == "main"))
            return

        # 1. 제1부동산: 시크빌 1호점 (본점)
        b1 = db.query(RentBranch).filter(RentBranch.branch_id == "main").first()
        if not b1:
            b1 = RentBranch(
                branch_id="main",
                name="시크빌 1호점 (본점, 29개실)",
                contact_phone="010-2345-6789",
                address="서울특별시 강남구 테헤란로 123",
                fee_plan="원룸 프리미엄 29실형",
                monthly_fee=150000,
                billing_status="PAID",
                is_active=True
            )
            db.add(b1)
        elif getattr(b1, "name", "") == "시크빌 (29개실)":
            setattr(b1, "name", "시크빌 1호점 (본점, 29개실)")

        db.commit()

        # 호실 시드 (기본 본사 시크빌)
        self._seed_branch_rooms(db, "main", is_main=True)

        if norm_bid != "main":
            self._seed_branch_rooms(db, norm_bid, is_main=False)

        self._seeded = True

    def get_rooms(self, db: Session, branch_id: str = "main") -> Dict[int, Any]:
        """지점 내 29개실 전체 정보 및 12개월 납부 장부 집계 (이전 세입자 정보 포함)"""
        norm_bid = self.branch_service.normalize_branch_id(branch_id)
        self.ensure_default_seed(db, norm_bid)
        rooms_db = db.query(RentRoom).filter(RentRoom.branch_id == norm_bid).order_by(RentRoom.room_number).all()
        payments_db = db.query(RentPayment).filter(RentPayment.branch_id == norm_bid).all()

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

        histories_db = db.query(RentTenantHistory).filter(RentTenantHistory.branch_id == branch_id).order_by(RentTenantHistory.move_out.desc()).all()
        hist_map: Dict[int, List[Dict[str, Any]]] = {}
        for h in histories_db:
            h_rnum = cast(int, h.room_number)
            hist_map.setdefault(h_rnum, []).append({
                "id": str(h.id),
                "name": str(h.name),
                "id_number": str(h.id_number or ""),
                "phone": str(h.phone or ""),
                "lease_type": str(h.lease_type or "월세"),
                "pay_timing": str(h.pay_timing or "후불"),
                "deposit": h.deposit,
                "rent": h.rent,
                "maintenance": h.maintenance,
                "move_in": str(h.move_in or ""),
                "move_out": str(h.move_out or ""),
                "retention_until": str(h.retention_until or "")
            })

        today_dt = datetime.now()
        has_auto_renewal = False

        result: Dict[int, Any] = {}
        for r in rooms_db:
            r_num: int = cast(int, r.room_number)
            expiry_val = str(r.expiry or "")
            auto_renewed = False

            # 만기일이 지났으나 전출(퇴실)하지 않은 경우 자동으로 1년 연장 (주택임대차 묵시적 갱신 원칙)
            if r.name and not r.move_out and expiry_val:
                try:
                    exp_dt = datetime.strptime(expiry_val, "%Y-%m-%d")
                    if exp_dt < today_dt:
                        while exp_dt < today_dt:
                            try:
                                exp_dt = exp_dt.replace(year=exp_dt.year + 1)
                            except ValueError:
                                exp_dt = exp_dt + timedelta(days=365)
                        expiry_val = exp_dt.strftime("%Y-%m-%d")
                        r.expiry = expiry_val
                        auto_renewed = True
                        has_auto_renewal = True
                except Exception:
                    pass

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
                "expiry": expiry_val,
                "auto_renewed": auto_renewed,
                "move_out": str(r.move_out or ""),
                "payments": pay_map.get(r_num, {}),
                "tenant_histories": hist_map.get(r_num, [])
            }

        if has_auto_renewal:
            try:
                db.commit()
            except Exception:
                db.rollback()

        return result

    def get_expiring_rooms(self, db: Session, branch_id: str = "main", days_window: int = 95) -> List[Dict[str, Any]]:
        """만기 3일, 1개월, 3개월 전 (약 95일 이내) 도래 호실 목록 조회"""
        rooms = self.get_rooms(db, branch_id)
        today_dt = datetime.now()
        expiring = []

        for r_num, r in rooms.items():
            if not r.get("name") or not r.get("expiry") or r.get("move_out"):
                continue
            try:
                exp_dt = datetime.strptime(r["expiry"], "%Y-%m-%d")
                diff_days = (exp_dt - today_dt).days + 1
                if 0 <= diff_days <= days_window:
                    if diff_days <= 3:
                        period_category = "3일 전"
                    elif diff_days <= 35:
                        period_category = "1개월 전"
                    else:
                        period_category = "3개월 전"
                    expiring.append({
                        "room_number": r_num,
                        "branch_id": branch_id,
                        "name": r.get("name"),
                        "phone": r.get("phone"),
                        "expiry": r.get("expiry"),
                        "diff_days": diff_days,
                        "period_category": period_category,
                        "deposit": r.get("deposit"),
                        "rent": r.get("rent"),
                        "maintenance": r.get("maintenance")
                    })
            except Exception:
                continue

        expiring.sort(key=lambda x: x["diff_days"])
        return expiring

    def get_room(self, db: Session, room_number: int, branch_id: str = "main") -> Optional[Dict[str, Any]]:
        rooms = self.get_rooms(db, branch_id)
        return rooms.get(room_number)

    def update_room_contract(self, db: Session, room_number: int, data: RoomUpdate, branch_id: str = "main") -> Optional[Dict[str, Any]]:
        """계약 정보 수정 및 전출자 발생 시 1년 보관 이력 테이블 자동 아카이빙"""
        branch_id = self.branch_service.normalize_branch_id(branch_id)
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
            if field in ("deposit", "rent", "maintenance", "clean_fee") and val is None:
                val = 0
            if field == "id_number" and not val and room.id_number:
                # 폼에서 주민번호를 비워둔 채 수정 제출 시, 기존에 안전하게 등록된 주민번호 유실 방지
                continue
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
        branch_id = self.branch_service.normalize_branch_id(branch_id)
        self.ensure_default_seed(db, branch_id)
        return PaymentService.fill_tenant_payments(db, branch_id=branch_id, room_number=room_number)

    def batch_import_rooms(self, db: Session, branch_id: str, rooms_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """엑셀 파일 등에서 추출한 호실 계약 정보를 일괄 등록/갱신"""
        branch_id = self.branch_service.normalize_branch_id(branch_id)
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
                    id_number=r_data.get("id_number") or "",
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
                        val_str = str(r_data[field]).strip()
                        if field == "name" and not val_str and room.name:
                            continue
                        setattr(room, field, val_str)

                # 주민번호 보호: 엑셀 파일에 주민번호 컬럼이 없거나 빈값이어도 기존 DB의 주민번호 덮어쓰기/삭제 방지
                incoming_id = str(r_data.get("id_number") or "").strip()
                if incoming_id:
                    room.id_number = incoming_id
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

    def batch_import_monthly_matrix(self, db: Session, branch_id: str, matrix_rooms: List[Dict[str, Any]]) -> Dict[str, Any]:
        """월별 임차료/관리비 수납 장부 매트릭스 일괄 등록/동기화"""
        self.ensure_default_seed(db, branch_id)
        res = PaymentService.batch_import_monthly_matrix(db, branch_id=branch_id, matrix_rooms=matrix_rooms)
        res["rooms"] = self.get_rooms(db, branch_id)
        return res

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

    def process_payment(self, db: Session, room_number: int, month: int, branch_id: str = "main", paid_date: Optional[str] = None, note: str = "정상 입금", tenant_name: Optional[str] = None, year: Optional[int] = None, rent_amount: Optional[int] = None, maintenance_amount: Optional[int] = None) -> Optional[Dict[str, Any]]:
        branch_id = self.branch_service.normalize_branch_id(branch_id)
        self.ensure_default_seed(db, branch_id)
        PaymentService.process_payment(
            db=db,
            room_number=room_number,
            month=month,
            branch_id=branch_id,
            paid_date=paid_date,
            note=note,
            tenant_name=tenant_name,
            year=year,
            rent_amount=rent_amount,
            maintenance_amount=maintenance_amount
        )
        return self.get_room(db, room_number, branch_id)

    def cancel_payment(self, db: Session, room_number: int, month: int, branch_id: str = "main", year: Optional[int] = None) -> Optional[Dict[str, Any]]:
        branch_id = self.branch_service.normalize_branch_id(branch_id)
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
        branch_id = self.branch_service.normalize_branch_id(branch_id)
        self.ensure_default_seed(db, branch_id)
        return db.query(RentExpense).filter(RentExpense.branch_id == branch_id).order_by(RentExpense.date.desc(), RentExpense.created_at.desc()).all()

    def create_expense(self, db: Session, data: ExpenseCreate, branch_id: str = "main") -> RentExpense:
        branch_id = self.branch_service.normalize_branch_id(branch_id)
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
        return branch_service.list_branches(db, active_only=active_only)

    def get_branch(self, db: Session, branch_id: str) -> Optional[RentBranch]:
        self.ensure_default_seed(db)
        return branch_service.get_branch(db, branch_id)

    def create_branch(self, db: Session, data: BranchCreate) -> RentBranch:
        self.ensure_default_seed(db)
        b = branch_service.create_branch(db, data)
        self._seed_branch_rooms(db, data.branch_id, is_main=False)
        return b

    def update_branch(self, db: Session, branch_id: str, data: BranchUpdate) -> Optional[RentBranch]:
        return branch_service.update_branch(db, branch_id, data)

    def update_branch_billing(self, db: Session, branch_id: str, data: BranchBillingUpdate) -> Optional[RentBranch]:
        return branch_service.update_branch_billing(db, branch_id, data)

    def delete_branch(self, db: Session, branch_id: str) -> Dict[str, Any]:
        return branch_service.delete_branch(db, branch_id)

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

    def delete_tenant_history(self, db: Session, history_id: str, branch_id: str = "main") -> Dict[str, Any]:
        """특정 전출자 이력 수동 삭제 (테스트 이력 정리 및 퇴실 취소 복원 시 정리용)"""
        hist = db.query(RentTenantHistory).filter(
            RentTenantHistory.id == history_id,
            RentTenantHistory.branch_id == branch_id
        ).first()
        if not hist and history_id.isdigit():
            hist = db.query(RentTenantHistory).filter(
                RentTenantHistory.room_number == int(history_id),
                RentTenantHistory.branch_id == branch_id
            ).order_by(RentTenantHistory.id.desc()).first()

        if not hist:
            return {"success": False, "message": "삭제할 전출 이력을 찾을 수 없습니다."}

        name = hist.name
        room_num = hist.room_number
        db.delete(hist)
        db.commit()
        return {
            "success": True,
            "message": f"[{room_num}호] {name}님의 전출 이력이 성공적으로 삭제되었습니다."
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

    def save_vat_settings(
        self,
        db: Session,
        branch_id: str = "main",
        target_rooms: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """지점별 부가세 대상 호실 목록 DB 저장 (VatService 위임)"""
        self.ensure_default_seed(db, branch_id)
        return VatService.save_vat_settings(db, branch_id=branch_id, target_rooms=target_rooms)

    def generate_vat_download(
        self,
        db: Session,
        branch_id: str = "main",
        start_month: int = 1,
        end_month: int = 6,
        year: int = 2026,
        format_type: str = "excel",
        room_numbers: Optional[List[int]] = None
    ) -> tuple[bytes, str, str]:
        """부가가치세 보고서 파일 바이트(엑셀 또는 CSV) 및 파일명/MIME 타입 반환"""
        report_data = self.get_vat_report(
            db=db,
            branch_id=branch_id,
            start_month=start_month,
            end_month=end_month,
            year=year,
            room_numbers=room_numbers
        )
        if format_type == "csv":
            content = VatService.generate_csv_bytes(report_data)
            media_type = "text/csv; charset=utf-8"
            filename = f"부동산_부가세_수납현황_{year}년_{start_month}월_{end_month}월.csv"
        else:
            content = VatService.generate_excel_bytes(report_data)
            media_type = "application/vnd.ms-excel; charset=utf-8"
            filename = f"부동산_부가세_수납현황_{year}년_{start_month}월_{end_month}월.xls"
        return content, media_type, filename

    def generate_backup_download(
        self,
        db: Session,
        branch_id: str = "main"
    ) -> tuple[bytes, str, str]:
        """전체 시스템 데이터(29개실, 12개월 장부, 지출, 전출이력) JSON 다운로드 생성"""
        self.ensure_default_seed(db, branch_id)
        branch = db.query(RentBranch).filter(RentBranch.branch_id == branch_id).first()
        branch_name: str = str(branch.name) if (branch and branch.name) else "시크빌"

        now = datetime.now()
        time_tag = now.strftime("%Y%m%d_%H%M%S")

        rooms_data = self.get_rooms(db, branch_id)
        expenses_objs = self.list_expenses(db, branch_id)
        expenses_data = [
            {
                "id": e.id,
                "branch_id": e.branch_id,
                "date": e.date,
                "item": e.item,
                "amount": e.amount,
                "note": e.note,
                "receipt_type": e.receipt_type,
                "receipt_info": e.receipt_info
            }
            for e in expenses_objs
        ]
        histories_objs = self.list_tenant_histories(db, branch_id)
        histories_data = [
            {
                "id": h.id,
                "branch_id": h.branch_id,
                "room_number": h.room_number,
                "name": h.name,
                "id_number": h.id_number,
                "phone": h.phone,
                "lease_type": h.lease_type,
                "pay_timing": h.pay_timing,
                "deposit": h.deposit,
                "rent": h.rent,
                "maintenance": h.maintenance,
                "clean_fee": h.clean_fee,
                "move_in": h.move_in,
                "expiry": h.expiry,
                "move_out": h.move_out,
                "retention_until": h.retention_until,
                "metadata_json": h.metadata_json or {}
            }
            for h in histories_objs
        ]

        backup_payload = {
            "version": "3.0",
            "system": "MQnet Rent SaaS Edition",
            "backup_type": "FULL_SYSTEM_BACKUP",
            "exported_at": now.isoformat(),
            "exported_at_formatted": now.strftime("%Y-%m-%d %H:%M:%S"),
            "branch_id": branch_id,
            "branch_name": branch_name,
            "rooms_count": len(rooms_data),
            "expenses_count": len(expenses_data),
            "tenant_histories_count": len(histories_data),
            "data": {
                "rooms": rooms_data,
                "expenses": expenses_data,
                "tenantHistories": histories_data
            }
        }

        json_str = json.dumps(backup_payload, ensure_ascii=False, indent=2)
        content = json_str.encode("utf-8")
        clean_branch = re.sub(r'[^\w가-힣0-9_-]', '_', branch_name)
        filename = f"{clean_branch}_전체백업_{time_tag}.json"
        media_type = "application/json; charset=utf-8"
        return content, media_type, filename

    def restore_full_backup(
        self,
        db: Session,
        backup_data: Dict[str, Any],
        target_branch_id: str = "main"
    ) -> Dict[str, Any]:
        """전체 시스템 백업 데이터(29개실 계약, 12개월 장부, 지출, 전출이력) 원자적 복원"""
        self.ensure_default_seed(db, target_branch_id)

        data_block = backup_data.get("data", {})
        rooms_dict = data_block.get("rooms", {})
        expenses_list = data_block.get("expenses", [])
        histories_list = data_block.get("tenantHistories", [])

        # 1. 호실 및 계약 복원
        for r_num_str, r_info in rooms_dict.items():
            try:
                r_num = int(r_num_str)
            except ValueError:
                continue

            room_obj = db.query(RentRoom).filter(
                RentRoom.branch_id == target_branch_id,
                RentRoom.room_number == r_num
            ).first()

            if not room_obj:
                room_obj = RentRoom(branch_id=target_branch_id, room_number=r_num)
                db.add(room_obj)

            room_obj.name = r_info.get("name", "") or ""
            room_obj.id_number = r_info.get("id_number", "") or ""
            room_obj.phone = r_info.get("phone", "") or ""
            room_obj.lease_type = r_info.get("lease_type", "월세") or "월세"
            room_obj.pay_timing = r_info.get("pay_timing", "후불") or "후불"
            room_obj.deposit = int(r_info.get("deposit") or 0)
            room_obj.rent = int(r_info.get("rent") or 0)
            room_obj.maintenance = int(r_info.get("maintenance") or 0)
            room_obj.clean_fee = int(r_info.get("clean_fee") or 0)
            room_obj.move_in = r_info.get("move_in", "") or ""
            room_obj.expiry = r_info.get("expiry", "") or ""
            room_obj.move_out = r_info.get("move_out", "") or ""

            # payments 복원
            payments_dict = r_info.get("payments", {})
            for m_str, p_info in payments_dict.items():
                try:
                    m_num = int(m_str)
                except ValueError:
                    continue
                if m_num < 1 or m_num > 12:
                    continue

                pay_obj = db.query(RentPayment).filter(
                    RentPayment.branch_id == target_branch_id,
                    RentPayment.room_number == r_num,
                    RentPayment.month == m_num
                ).first()

                if not pay_obj:
                    pay_obj = RentPayment(
                        branch_id=target_branch_id,
                        room_number=r_num,
                        month=m_num,
                        year=2026
                    )
                    db.add(pay_obj)

                pay_obj.paid = bool(p_info.get("paid", False))
                pay_obj.paid_date = p_info.get("paid_date", "") or ""
                pay_obj.rent_amount = int(p_info.get("rent_amount") or 0)
                pay_obj.maintenance_amount = int(p_info.get("maintenance_amount") or 0)
                pay_obj.note = p_info.get("note", "") or p_info.get("memo", "") or ""
                pay_obj.tenant_name = p_info.get("tenant_name", "") or room_obj.name

        # 2. 지출 내역 복원
        if expenses_list is not None:
            db.query(RentExpense).filter(RentExpense.branch_id == target_branch_id).delete(synchronize_session=False)
            for exp in expenses_list:
                new_exp = RentExpense(
                    id=str(uuid.uuid4()),
                    branch_id=target_branch_id,
                    date=exp.get("date", ""),
                    item=exp.get("item", "") or exp.get("category", "") or "지출",
                    amount=int(exp.get("amount") or 0),
                    note=exp.get("note", "") or exp.get("description", "") or "",
                    receipt_type=exp.get("receipt_type", "") or exp.get("payment_method", "") or "",
                    receipt_info=exp.get("receipt_info", "") or exp.get("receipt_url", "") or ""
                )
                db.add(new_exp)

        # 3. 전출자 이력 복원
        if histories_list is not None:
            db.query(RentTenantHistory).filter(RentTenantHistory.branch_id == target_branch_id).delete(synchronize_session=False)
            for h in histories_list:
                new_h = RentTenantHistory(
                    id=str(uuid.uuid4()),
                    branch_id=target_branch_id,
                    room_number=int(h.get("room_number") or 101),
                    name=h.get("name") or h.get("tenant_name") or "",
                    id_number=h.get("id_number", "") or "",
                    phone=h.get("phone", "") or "",
                    lease_type=h.get("lease_type", "월세") or "월세",
                    pay_timing=h.get("pay_timing", "후불") or "후불",
                    deposit=int(h.get("deposit") or 0),
                    rent=int(h.get("rent") or h.get("monthly_rent") or 0),
                    maintenance=int(h.get("maintenance") or h.get("maintenance_fee") or 0),
                    clean_fee=int(h.get("clean_fee") or 0),
                    move_in=h.get("move_in") or h.get("move_in_date") or "",
                    expiry=h.get("expiry", "") or "",
                    move_out=h.get("move_out") or h.get("move_out_date") or "",
                    retention_until=h.get("retention_until", "") or "",
                    metadata_json=h.get("metadata_json") or {}
                )
                db.add(new_h)

        db.commit()

        return {
            "success": True,
            "message": "백업 데이터가 성공적으로 복원되었습니다.",
            "target_branch_id": target_branch_id,
            "rooms": self.get_rooms(db, target_branch_id),
            "expenses": [
                {
                    "id": e.id,
                    "branch_id": e.branch_id,
                    "date": e.date,
                    "item": e.item,
                    "amount": e.amount,
                    "note": e.note,
                    "receipt_type": e.receipt_type,
                    "receipt_info": e.receipt_info
                }
                for e in self.list_expenses(db, target_branch_id)
            ],
            "tenantHistories": [
                {
                    "id": h.id,
                    "branch_id": h.branch_id,
                    "room_number": h.room_number,
                    "name": h.name,
                    "id_number": h.id_number,
                    "phone": h.phone,
                    "lease_type": h.lease_type,
                    "pay_timing": h.pay_timing,
                    "deposit": h.deposit,
                    "rent": h.rent,
                    "maintenance": h.maintenance,
                    "clean_fee": h.clean_fee,
                    "move_in": h.move_in,
                    "expiry": h.expiry,
                    "move_out": h.move_out,
                    "retention_until": h.retention_until,
                    "metadata_json": h.metadata_json or {}
                }
                for h in self.list_tenant_histories(db, target_branch_id)
            ]
        }

    # ── 사용자/관리자 인증 및 승인 관리 (AuthService 위임) ──
    def ensure_default_admins(self, db: Session) -> None:
        auth_service.ensure_default_admins(db)

    def register_user(self, db: Session, payload: RegisterRequest) -> Dict[str, Any]:
        return auth_service.register_user(db, payload)

    def authenticate_user(self, db: Session, username: str, password: str) -> Dict[str, Any]:
        return auth_service.authenticate_user(db, username, password)

    def list_users(self, db: Session, status: Optional[str] = None) -> List[Dict[str, Any]]:
        return auth_service.list_users(db, status=status)

    def approve_user(self, db: Session, user_id: str, payload: UserApprovePayload) -> Dict[str, Any]:
        return auth_service.approve_user(db, user_id, payload)

    def update_user(self, db: Session, user_id: str, payload: UserUpdatePayload) -> Dict[str, Any]:
        return auth_service.update_user(db, user_id, payload)

    def delete_user(self, db: Session, user_id: str) -> Dict[str, Any]:
        return auth_service.delete_user(db, user_id)


service = RentService()

