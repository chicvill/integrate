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

from ..db.models import RentRoom, RentPayment, RentTenantHistory


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
        # 전입 이전: 이전 세입자 데이터 있으면 완납 보존, 없으면 미납
        if has_prev_hist:
            return True, "이전 세입자 정상 입금 (전출)"
        return False, "전입 이전 (기록 없음/미납)"

    if is_move_in_month:
        # 입주월: 월세/후불인 경우 익월 납부이므로 미납 처리!
        if is_monthly and is_postpaid:
            return False, "입주월 (후불 익월 청구/미납)"
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
        year: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """호실 월별 수납 처리 및 실입금일자 저장"""
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
        return None

    @staticmethod
    def cancel_payment(
        db: Session,
        room_number: int,
        month: int,
        branch_id: str = "main",
        year: Optional[int] = None
    ) -> bool:
        """수납 취소 (미납으로 환원)"""
        pay_year = year or datetime.now().year
        pay = db.query(RentPayment).filter(
            RentPayment.branch_id == branch_id,
            RentPayment.room_number == room_number,
            RentPayment.year == pay_year,
            RentPayment.month == month
        ).first()
        if not pay:
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
            return True
        return False
