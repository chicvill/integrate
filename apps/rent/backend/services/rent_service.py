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

            # 201호: 이전 세입자 "박지훈"이 1~6월 거주 및 완납 후 6월 30일 전출, 현 세입자 "이서연"이 7월 1일 전입
            has_prev_tenant = is_main and (rNum == 201)

            room = RentRoom(
                branch_id=branch_id,
                room_number=rNum,
                name=name,
                id_number="" if is_vacant else f"9{(idx % 9) + 1}0512-1******",
                phone="" if is_vacant else f"010-2{str(idx).zfill(3)}-{str(rNum).zfill(4)}",
                lease_type=lease_type,
                pay_timing=pay_timing,
                deposit=deposit_amt,
                rent=rent_amt,
                maintenance=50000,
                clean_fee=80000,
                move_in=f"{cur_year}-07-01" if has_prev_tenant else ("" if is_vacant else f"{cur_year}-01-15"),
                expiry="" if is_vacant else f"{cur_year + 1}-01-14",
                move_out=""
            )
            db.add(room)

            if has_prev_tenant:
                # 201호 전출자 이력 1년 보관 생성 (전출일 2026-06-30 -> 보존기한 2027-06-30)
                move_out_date = f"{cur_year}-06-30"
                retention_date = f"{cur_year + 1}-06-30"
                hist = RentTenantHistory(
                    branch_id=branch_id,
                    room_number=rNum,
                    name="박지훈",
                    id_number="940315-1******",
                    phone="010-9876-0201",
                    lease_type="월세",
                    pay_timing="후불",
                    deposit=5000000,
                    rent=rent_amt,
                    maintenance=50000,
                    clean_fee=80000,
                    move_in=f"{cur_year - 1}-07-01",
                    expiry=f"{cur_year}-06-30",
                    move_out=move_out_date,
                    retention_until=retention_date
                )
                db.add(hist)

            # 1~12월 납부 기록
            for m in range(1, 13):
                is_past_paid = (not is_vacant) and (m < cur_month)
                
                # 세입자 배정
                if has_prev_tenant and m <= 6:
                    t_name = "박지훈"
                    t_prev = True
                    p_note = "이전 세입자 정상 입금 (전출)"
                else:
                    t_name = name
                    t_prev = False
                    p_note = "정상 입금" if is_past_paid else ""

                pay = RentPayment(
                    branch_id=branch_id,
                    room_number=rNum,
                    year=cur_year,
                    month=m,
                    paid=is_past_paid,
                    paid_date=f"{cur_year}-{str(m).zfill(2)}-10" if is_past_paid else "",
                    rent_amount=rent_amt,
                    maintenance_amount=50000,
                    note=p_note,
                    tenant_name=t_name,
                    tenant_id_number="" if is_vacant else f"9{(idx % 9) + 1}0512-1******",
                    is_previous_tenant=t_prev
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

        pay_map: Dict[int, Dict[int, Any]] = {}
        for p in payments_db:
            if p.room_number not in pay_map:
                pay_map[p.room_number] = {}
            pay_map[p.room_number][p.month] = {
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
        is_move_out = bool(data.move_out) or (old_name and new_name and old_name != new_name) or (old_name and not new_name)

        # 전출자 아카이빙 (전출일로부터 1년간 DB 보존)
        if is_move_out and old_name:
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

            # 이전 세입자가 납부한 과거 기록을 is_previous_tenant = True로 태깅
            cur_month = datetime.now().month
            past_payments = db.query(RentPayment).filter(
                RentPayment.branch_id == branch_id,
                RentPayment.room_number == room_number,
                RentPayment.month < cur_month
            ).all()
            for p in past_payments:
                if not p.tenant_name or p.tenant_name == old_name:
                    p.tenant_name = old_name
                    p.is_previous_tenant = True

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

        db.commit()
        return self.get_room(db, room_number, branch_id)

    def process_payment(self, db: Session, room_number: int, month: int, branch_id: str = "main", paid_date: Optional[str] = None, note: str = "정상 입금", tenant_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        self.ensure_default_seed(db, branch_id)
        now_date = paid_date or datetime.now().strftime("%Y-%m-%d")
        pay = db.query(RentPayment).filter(
            RentPayment.branch_id == branch_id,
            RentPayment.room_number == room_number,
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
                year=datetime.now().year,
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

    def cancel_payment(self, db: Session, room_number: int, month: int, branch_id: str = "main") -> Optional[Dict[str, Any]]:
        self.ensure_default_seed(db, branch_id)
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

    def list_tenant_histories(self, db: Session, branch_id: str = "main", room_number: Optional[int] = None) -> List[RentTenantHistory]:
        """전출 후 1년간 필수 보관되는 전출자 이력 조회 (만료일 이전 데이터 보존)"""
        self.ensure_default_seed(db, branch_id)
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
            "rows": report_rows
        }


service = RentService()
