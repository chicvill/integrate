"""
apps/rent/backend/services/payment_service.py
원룸 임차료/관리비 납부 장부 및 수납 처리 전담 도메인 서비스 (Clean Architecture).
- 롤링 12개월(Option A) 및 후불/선불 입주월 규칙 캡슐화
- 세입자 전입일 기준 자동 동기화
- 수납(실입금일자 지정) 및 수납 취소 처리
"""
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, cast
from sqlalchemy.orm import Session

from ..db.models import RentRoom, RentPayment, RentTenantHistory, RentBranch
from .branch_service import normalize_branch_id



def parse_date_to_dt(val: Any) -> Optional[datetime]:
    """다양한 날짜 포맷 (YYYY-MM-DD, YYYY. M. D, YYYY/MM/DD, YYYY.MM.DD 등)을 안전하게 datetime 객체로 변환"""
    if not val:
        return None
    s = str(val).strip()
    m = re.search(r'(\d{4})\s*[-./년\s]\s*(\d{1,2})\s*[-./월\s]\s*(\d{1,2})', s)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except Exception:
            pass
    m2 = re.search(r'(\d{4})(\d{2})(\d{2})', s)
    if m2:
        try:
            return datetime(int(m2.group(1)), int(m2.group(2)), int(m2.group(3)))
        except Exception:
            pass
    return None


def get_rolling_periods(cur_year: int, cur_month: int, count: int = 12) -> List[Tuple[int, int]]:
    """현재월 기준 직전 12개월 롤링 회차 + 당해 미래월 목록 생성"""
    periods: List[Tuple[int, int]] = []
    for i in range(count):
        m_calc = cur_month - i
        y_calc = cur_year
        if m_calc <= 0:
            m_calc += 12
            y_calc -= 1
        periods.append((y_calc, m_calc))

    for m_future in range(cur_month + 1, 13):
        if (cur_year, m_future) not in periods:
            periods.append((cur_year, m_future))
    return periods


def evaluate_payment_status(
    y: int,
    m: int,
    dt_in: Optional[datetime],
    is_monthly: bool,
    is_postpaid: bool,
    cur_year: int,
    cur_month: int,
    has_prev_hist: bool
) -> Tuple[bool, str]:
    """
    호실 전입일 및 계약 조건(월세/후불 등)에 따른 회차별 납부 상태 및 비고 판정
    Returns: (paid: bool, note: str)
    """
    is_before_move_in = False
    is_move_in_month = False
    if dt_in:
        if y < dt_in.year or (y == dt_in.year and m < dt_in.month):
            is_before_move_in = True
        elif y == dt_in.year and m == dt_in.month:
            is_move_in_month = True

    is_future = (y > cur_year) or (y == cur_year and m > cur_month)

    if is_before_move_in:
        # 전입 이전: 이전 세입자 데이터 있으면 완납 보존, 없으면 공실 (퇴실 후 다음 입주월 사이 공실 원칙)
        if has_prev_hist:
            return True, "이전 세입자 정상 입금 (전출)"
        return False, "공실"

    if is_move_in_month:
        # 입주월: 월세/후불인 경우 익월 청구 원칙 적용 (가짜 체납 Ghost Overdue 방지)
        if is_monthly and is_postpaid:
            return True, "입주월 (후불 익월 청구/정상)"
        return True, "입주월 선납 완납"

    if not is_future:
        # 입주월 익월 ~ 현재월까지: 정상 완납
        return True, "정상 입금"

    # 미래 월: 미납 대기
    return False, ""


class PaymentService:
    @staticmethod
    def fill_tenant_payments(
        db: Session,
        branch_id: str = "main",
        room_number: Optional[int] = None
    ) -> Dict[str, Any]:
        """현재 세입자의 전입일부터 현재월까지의 과거 납부 내역을 현재 세입자 정보 및 완납으로 동기화 채우기"""
        branch_id = normalize_branch_id(branch_id)
        now = datetime.now()
        cur_year = now.year
        cur_month = now.month

        query = db.query(RentRoom).filter(RentRoom.branch_id == branch_id)
        if room_number is not None:
            query = query.filter(RentRoom.room_number == room_number)
        rooms = query.all()

        updated_rooms: List[int] = []
        for r in rooms:
            if not r.name:
                continue

            # 전입일 파싱 (다양한 포맷 대응)
            dt_in: Optional[datetime] = parse_date_to_dt(r.move_in)

            # 전출자 이력 조회 (전입 이전 기록 배정용)
            prev_hist = db.query(RentTenantHistory).filter(
                RentTenantHistory.branch_id == branch_id,
                RentTenantHistory.room_number == r.room_number
            ).order_by(RentTenantHistory.id.desc()).first()

            rent_amt = 0 if r.lease_type == "전세" else (r.rent or 0)
            maint_amt = r.maintenance or 0
            is_postpaid = (r.pay_timing == "후불" or not r.pay_timing)
            is_monthly = (r.lease_type == "월세" or not r.lease_type)

            periods_to_process = get_rolling_periods(cur_year, cur_month, 12)

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

                is_paid, note = evaluate_payment_status(
                    y=y,
                    m=m,
                    dt_in=dt_in,
                    is_monthly=is_monthly,
                    is_postpaid=is_postpaid,
                    cur_year=cur_year,
                    cur_month=cur_month,
                    has_prev_hist=bool(prev_hist)
                )

                is_before = dt_in and (y < dt_in.year or (y == dt_in.year and m < dt_in.month))
                if is_before and prev_hist:
                    # 이전 세입자 기록 보존
                    pay.tenant_name = prev_hist.name
                    pay.tenant_id_number = prev_hist.id_number or ""
                    pay.is_previous_tenant = True
                    pay.paid = is_paid
                    pay.paid_date = f"{y}-{str(m).zfill(2)}-10" if is_paid else ""
                    pay.rent_amount = 0 if prev_hist.lease_type == "전세" else prev_hist.rent
                    pay.maintenance_amount = prev_hist.maintenance
                    pay.note = note
                else:
                    # 현재 세입자 기록
                    pay.tenant_name = r.name
                    pay.tenant_id_number = r.id_number or ""
                    pay.is_previous_tenant = False
                    pay.paid = is_paid
                    pay.paid_date = f"{y}-{str(m).zfill(2)}-10" if is_paid else ""
                    pay.rent_amount = rent_amt
                    pay.maintenance_amount = maint_amt
                    pay.note = note

            updated_rooms.append(cast(int, r.room_number))

        db.commit()
        return {
            "success": True,
            "updated_rooms": updated_rooms,
            "count": len(updated_rooms),
            "message": f"{len(updated_rooms)}개 호실의 전입일 기준 납부내역이 동기화되었습니다."
        }

    @staticmethod
    def process_payment(
        db: Session,
        room_number: int,
        month: int,
        branch_id: str = "main",
        paid_date: Optional[str] = None,
        note: str = "정상 입금",
        tenant_name: Optional[str] = None,
        year: Optional[int] = None,
        rent_amount: Optional[int] = None,
        maintenance_amount: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """호실 월별 수납 처리 및 실입금일자/금액 저장"""
        branch_id = normalize_branch_id(branch_id)
        now_date = paid_date or datetime.now().strftime("%Y-%m-%d")
        pay_year = year or datetime.now().year
        pays = db.query(RentPayment).filter(
            RentPayment.branch_id == branch_id,
            RentPayment.room_number == room_number,
            RentPayment.year == pay_year,
            RentPayment.month == month
        ).all()
        if not pays:
            pays = db.query(RentPayment).filter(
                RentPayment.branch_id == branch_id,
                RentPayment.room_number == room_number,
                RentPayment.month == month
            ).all()

        room = db.query(RentRoom).filter(
            RentRoom.branch_id == branch_id,
            RentRoom.room_number == room_number
        ).first()
        if not room:
            return None

        effective_name = tenant_name or room.name or "공실"

        default_rent = 0 if room.lease_type == "전세" else room.rent
        default_maint = room.maintenance

        final_rent = rent_amount if rent_amount is not None else default_rent
        final_maint = maintenance_amount if maintenance_amount is not None else default_maint

        if not pays:
            pay = RentPayment(
                branch_id=branch_id,
                room_number=room_number,
                year=pay_year,
                month=month,
                rent_amount=final_rent,
                maintenance_amount=final_maint,
                tenant_name=effective_name,
                is_previous_tenant=False
            )
            db.add(pay)
        else:
            pay = pays[0]
            if rent_amount is not None:
                pay.rent_amount = rent_amount
            elif not pay.rent_amount:
                pay.rent_amount = default_rent

            if maintenance_amount is not None:
                pay.maintenance_amount = maintenance_amount
            elif not pay.maintenance_amount:
                pay.maintenance_amount = default_maint

            # 중복 레코드 정리
            for extra in pays[1:]:
                db.delete(extra)

        pay.year = pay_year
        pay.month = month
        pay.paid = True
        pay.paid_date = now_date
        pay.note = note
        pay.tenant_name = effective_name
        pay.is_previous_tenant = False
        db.commit()
        return {"success": True, "room_number": room_number, "branch_id": branch_id, "month": month, "year": pay_year}

    @staticmethod
    def cancel_payment(
        db: Session,
        room_number: int,
        month: int,
        branch_id: str = "main",
        year: Optional[int] = None,
        note: Optional[str] = "납부 취소"
    ) -> bool:
        """수납 취소 또는 공실/미납 전환 (중복 레코드 원천 제거)"""
        branch_id = normalize_branch_id(branch_id)
        pay_year = year or datetime.now().year
        effective_note = note or "납부 취소"
        is_vacancy = bool("공실" in effective_note)

        pays = db.query(RentPayment).filter(
            RentPayment.branch_id == branch_id,
            RentPayment.room_number == room_number,
            RentPayment.year == pay_year,
            RentPayment.month == month
        ).all()
        if not pays:
            pays = db.query(RentPayment).filter(
                RentPayment.branch_id == branch_id,
                RentPayment.room_number == room_number,
                RentPayment.month == month
            ).all()

        room = db.query(RentRoom).filter(
            RentRoom.branch_id == branch_id,
            RentRoom.room_number == room_number
        ).first()

        if pays:
            primary = pays[0]
            primary.year = pay_year
            primary.month = month
            primary.paid = False
            primary.paid_date = ""
            primary.note = effective_note
            if is_vacancy:
                primary.tenant_name = "공실"
                primary.rent_amount = 0
                primary.maintenance_amount = 0
            elif room:
                primary.tenant_name = room.name or ""
                primary.rent_amount = 0 if room.lease_type == "전세" else room.rent
                primary.maintenance_amount = room.maintenance
            # 중복 레코드는 모두 삭제하여 단일성 유지
            for extra in pays[1:]:
                db.delete(extra)
            db.commit()
            return True
        else:
            if room:
                def_rent = 0 if (is_vacancy or room.lease_type == "전세") else room.rent
                def_maint = 0 if is_vacancy else room.maintenance
                new_pay = RentPayment(
                    branch_id=branch_id,
                    room_number=room_number,
                    year=pay_year,
                    month=month,
                    paid=False,
                    paid_date="",
                    rent_amount=def_rent,
                    maintenance_amount=def_maint,
                    note=effective_note,
                    tenant_name="공실" if is_vacancy else (room.name or ""),
                    tenant_id_number="",
                    is_previous_tenant=False
                )
                db.add(new_pay)
                db.commit()
                return True
        return False

    @staticmethod
    def clean_duplicate_payments(db: Session, branch_id: Optional[str] = None) -> int:
        """중복된 (branch_id, room_number, year, month) 레코드 정리"""
        branch_id = normalize_branch_id(branch_id) if branch_id else None
        query = db.query(RentPayment)
        if branch_id:
            query = query.filter(RentPayment.branch_id == branch_id)
        all_pays = query.all()

        grouped: Dict[Any, List[RentPayment]] = {}
        for p in all_pays:
            key = (p.branch_id, p.room_number, p.year, p.month)
            grouped.setdefault(key, []).append(p)

        deleted_count = 0
        for key, p_list in grouped.items():
            if len(p_list) > 1:
                # 완납 또는 내용이 있는 레코드를 우선 보존 (모두 동일하면 첫 번째 보존)
                p_list.sort(key=lambda x: (1 if x.paid else 0, len(x.paid_date or ""), len(x.note or "")), reverse=True)
                for extra in p_list[1:]:
                    db.delete(extra)
                    deleted_count += 1
        if deleted_count > 0:
            db.commit()
        return deleted_count

    @staticmethod
    def batch_import_monthly_matrix(
        db: Session,
        branch_id: str,
        matrix_rooms: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """월별 수납장부 매트릭스 일괄 등록/갱신"""
        branch_id = normalize_branch_id(branch_id)
        updated_records = 0
        rooms_db = {r.room_number: r for r in db.query(RentRoom).filter(RentRoom.branch_id == branch_id).all()}

        for item in matrix_rooms:
            try:
                r_num = int(item.get("room_number") or 0)
            except Exception:
                continue
            if not r_num:
                continue

            room = rooms_db.get(r_num)
            def_rent = room.rent if room else 400000
            def_maint = room.maintenance if room else 50000
            t_name = item.get("name") or (room.name if room else "")
            t_id = (room.id_number if room else "")

            if room:
                if item.get("name") and not room.name:
                    room.name = str(item["name"])
                if item.get("pay_timing"):
                    room.pay_timing = str(item["pay_timing"])

            for p in item.get("payments", []):
                try:
                    y = int(p.get("year") or 2026)
                    m = int(p.get("month") or 1)
                except Exception:
                    continue

                is_paid = bool(p.get("paid"))
                p_date = str(p.get("paid_date") or "")
                total_amt = int(p.get("amount") or 0)
                note = str(p.get("note") or "")

                if is_paid:
                    if room and room.lease_type == "전세":
                        m_amt = total_amt
                        r_amt = 0
                    else:
                        m_amt = min(def_maint, total_amt) if def_maint > 0 else 0
                        r_amt = total_amt - m_amt
                else:
                    r_amt = def_rent
                    m_amt = def_maint

                existing_pay = db.query(RentPayment).filter(
                    RentPayment.branch_id == branch_id,
                    RentPayment.room_number == r_num,
                    RentPayment.year == y,
                    RentPayment.month == m
                ).first()

                if existing_pay:
                    existing_pay.paid = is_paid
                    existing_pay.paid_date = p_date
                    existing_pay.rent_amount = r_amt
                    existing_pay.maintenance_amount = m_amt
                    if note:
                        existing_pay.note = note
                    if t_name:
                        existing_pay.tenant_name = t_name
                    if t_id:
                        existing_pay.tenant_id_number = t_id
                else:
                    new_pay = RentPayment(
                        branch_id=branch_id,
                        room_number=r_num,
                        year=y,
                        month=m,
                        paid=is_paid,
                        paid_date=p_date,
                        rent_amount=r_amt,
                        maintenance_amount=m_amt,
                        note=note,
                        tenant_name=t_name,
                        tenant_id_number=t_id,
                        is_previous_tenant=False
                    )
                    db.add(new_pay)
                updated_records += 1

        db.commit()
        return {
            "success": True,
            "branch_id": branch_id,
            "total_rooms": len(matrix_rooms),
            "updated_records": updated_records
        }

    @staticmethod
    def batch_collect_payments(
        db: Session,
        branch_id: str,
        year: int = 2026,
        start_month: int = 1,
        end_month: int = 10,
        payment_date_mode: str = "contract",
        specific_date: Optional[str] = None,
        note: str = "정상 입금 (일괄 수납)",
        include_unoccupied: bool = False
    ) -> Dict[str, Any]:
        """선택한 건물의 특정 기간(월 범위)을 모든 호실에 대해 일괄 수납(완납) 처리하는 범용 서비스"""
        norm_bid = normalize_branch_id(branch_id)
        branch = db.query(RentBranch).filter(RentBranch.branch_id == norm_bid).first()
        branch_name = branch.name if branch else norm_bid

        rooms = db.query(RentRoom).filter(RentRoom.branch_id == norm_bid).all()
        if not rooms:
            return {
                "success": False,
                "branch_id": norm_bid,
                "branch_name": branch_name,
                "year": year,
                "start_month": start_month,
                "end_month": end_month,
                "total_rooms": 0,
                "updated_count": 0,
                "total_amount": 0,
                "message": f"'{branch_name}' 건물에 등록된 호실이 없습니다."
            }

        start_m = max(1, min(12, start_month))
        end_m = max(1, min(12, end_month))
        if start_m > end_m:
            start_m, end_m = end_m, start_m

        updated_count = 0
        total_amount = 0

        for r in rooms:
            rent_amt = 0 if r.lease_type == "전세" else (r.rent or 0)
            maint_amt = r.maintenance or 0
            charge = rent_amt + maint_amt

            pay_day = 25
            meta_str = str(r.metadata_json or "")
            m_day = re.search(r'납부일:\s*(\d+)일', meta_str)
            if m_day:
                pay_day = min(int(m_day.group(1)), 28)
            else:
                m_day2 = re.search(r'(\d+)일', meta_str)
                if m_day2:
                    pay_day = min(int(m_day2.group(1)), 28)

            dt_in = parse_date_to_dt(r.move_in)

            for m in range(start_m, end_m + 1):
                if not include_unoccupied and dt_in:
                    if year < dt_in.year or (year == dt_in.year and m < dt_in.month):
                        continue

                if payment_date_mode == "specific" and specific_date:
                    p_date = specific_date
                else:
                    p_date = f"{year}-{str(m).zfill(2)}-{str(pay_day).zfill(2)}"

                pay = db.query(RentPayment).filter(
                    RentPayment.branch_id == norm_bid,
                    RentPayment.room_number == r.room_number,
                    RentPayment.year == year,
                    RentPayment.month == m
                ).first()

                if pay:
                    pay.paid = 1
                    pay.paid_date = p_date
                    pay.rent_amount = rent_amt
                    pay.maintenance_amount = maint_amt
                    pay.note = note
                    if r.name:
                        pay.tenant_name = r.name
                else:
                    pay = RentPayment(
                        branch_id=norm_bid,
                        room_number=r.room_number,
                        year=year,
                        month=m,
                        paid=1,
                        paid_date=p_date,
                        rent_amount=rent_amt,
                        maintenance_amount=maint_amt,
                        note=note,
                        tenant_name=r.name or "",
                        tenant_id_number=r.id_number or "",
                        is_previous_tenant=False
                    )
                    db.add(pay)

                updated_count += 1
                total_amount += charge

        db.commit()

        return {
            "success": True,
            "branch_id": norm_bid,
            "branch_name": branch_name,
            "year": year,
            "start_month": start_m,
            "end_month": end_m,
            "total_rooms": len(rooms),
            "updated_count": updated_count,
            "total_amount": total_amount,
            "message": f"[{branch_name}] {len(rooms)}개실의 {year}년 {start_m}월~{end_m}월 총 {updated_count}건({total_amount:,}원) 일괄 납입 처리가 완료되었습니다."
        }

