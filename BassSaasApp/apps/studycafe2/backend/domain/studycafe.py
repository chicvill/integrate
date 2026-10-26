"""
domain/studycafe.py — 스터디카페 도메인 객체 (OOP Domain-Driven Design).

  Branch(지점)  Seat(좌석)  Member(회원)  Ticket(이용권)  StudySession(이용기록)  Payment(결제)

핵심 설계: 복잡한 SQL/테이블 대신 도메인 객체가 자신의 상태와 비즈니스 규칙(입퇴실, 시간차감, 외출, 일시정지, 심야 셧다운)을 스스로 검증하고 처리한다.
"""
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional
from pydantic import Field
from ..kernel.base import Obj, store

def now_dt() -> datetime:
    return datetime.now()

def now_str() -> str:
    return now_dt().strftime("%Y-%m-%d %H:%M:%S")

def today_str() -> str:
    return date.today().isoformat()


# ───────────────────────────── 지점 ─────────────────────────────
class Branch(Obj):
    scope_field = "id"
    name: str = "시크빌 스터디카페 1호점"
    address: str = "서울특별시 강남구 테헤란로 123 3층"
    contact_phone: str = "010-2345-6789"
    wifi_ssid: str = "CHICVILL_STUDY_5G"
    wifi_pw: str = "chicvill1212"
    minor_curfew_enabled: bool = True  # 22:00 청소년 심야 셧다운 여부
    total_seats_count: int = 20

    @classmethod
    def require(cls, ref: Optional[str] = None) -> "Branch":
        ref = (ref or "studycafe-main").strip()
        b = cls.get(ref) or next((b for b in cls.all() if ref.lower() in b.name.lower()), None)
        if not b:
            b = cls(id="studycafe-main").save("seeded")
        return b

    def seats(self) -> List["Seat"]:
        return sorted(Seat.find(self.id), key=lambda s: s.seat_number)

    def stats(self) -> Dict[str, Any]:
        ss = self.seats()
        occ = [s for s in ss if s.status == "OCCUPIED"]
        out = [s for s in ss if s.status == "STEP_OUT"]
        emp = [s for s in ss if s.status == "EMPTY"]
        fixed = [s for s in ss if s.is_fixed]
        return {
            "branch_id": self.id,
            "branch_name": self.name,
            "total_seats": len(ss),
            "occupied_count": len(occ),
            "step_out_count": len(out),
            "empty_count": len(emp),
            "fixed_count": len(fixed),
            "occupancy_rate": round(len(occ + out) / len(ss) * 100, 1) if ss else 0
        }


# ───────────────────────────── 회원 ─────────────────────────────
class Member(Obj):
    scope_field = "branch_id"
    branch_id: str = "studycafe-main"
    phone: str = ""                # 010-1234-5678 (고유 식별자)
    name: str = ""
    pin_code: str = "0000"         # 간편 출입 키오스크 4자리
    user_type: str = "GENERAL"     # 'GENERAL' (자율형) | 'MANAGED' (관리형)
    is_minor: bool = False         # 미성년자 (22시 셧다운 대상)
    night_exempt: bool = False     # 학부모 동의 야간 허용 여부
    parent_phone: str = ""         # 학부모 안심 SMS 수신처
    penalty_points: int = 0
    fixed_seat: Optional[str] = None

    @classmethod
    def by_phone(cls, phone: str, branch_id: str = "studycafe-main") -> Optional["Member"]:
        clean = phone.replace("-", "").replace(" ", "").strip()
        for m in cls.find(branch_id):
            if m.phone.replace("-", "").replace(" ", "").strip() == clean:
                return m
        return None

    def active_tickets(self) -> List["Ticket"]:
        return [t for t in Ticket.find(self.branch_id, member_id=self.id) if t.is_valid()]

    def summary(self) -> str:
        role = "관리형" if self.user_type == "MANAGED" else "일반형"
        minor = "청소년(22시 제한)" if self.is_minor and not self.night_exempt else "일반"
        return f"{self.name} ({self.phone[-4:]} / {role} / {minor})"


# ───────────────────────────── 이용권 ─────────────────────────────
class Ticket(Obj):
    scope_field = "branch_id"
    branch_id: str = "studycafe-main"
    member_id: str = ""
    member_name: str = ""
    member_phone: str = ""
    ticket_type: str = "4주권"       # "2시간권", "50시간권", "4주권", "4주 관리형 고정석" 등
    is_time_ticket: bool = False    # 시간권(True) or 기간권(False)
    total_minutes: int = 0
    remaining_minutes: int = 0
    valid_from: str = ""            # YYYY-MM-DD
    valid_until: str = ""           # YYYY-MM-DD
    price: int = 0
    is_active: bool = True
    is_held: bool = False           # 일시정지(Hold) 여부
    hold_count: int = 0             # 최대 2회
    hold_total_days: int = 0        # 최대 14일
    hold_started_at: Optional[str] = None

    def is_valid(self) -> bool:
        if not self.is_active or self.is_held:
            return False
        if self.is_time_ticket:
            return self.remaining_minutes > 0
        if self.valid_until:
            today = today_str()
            return self.valid_until >= today
        return True

    def consume(self, minutes: int) -> int:
        if not self.is_time_ticket:
            return 0
        used = min(self.remaining_minutes, minutes)
        self.remaining_minutes -= used
        if self.remaining_minutes <= 0:
            self.is_active = False
        self.save("time_consumed", used=used, remaining=self.remaining_minutes)
        return used

    def hold(self, days: int = 7) -> str:
        if self.is_time_ticket:
            raise ValueError("시간권은 일시정지 대상이 아닙니다.")
        if self.is_held:
            raise ValueError("이미 일시정지 중인 이용권입니다.")
        if self.hold_count >= 2:
            raise ValueError("일시정지는 최대 2회까지만 가능합니다.")
        if self.hold_total_days + days > 14:
            raise ValueError(f"일시정지 총 잔여 가능일은 {14 - self.hold_total_days}일입니다.")

        self.is_held = True
        self.hold_count += 1
        self.hold_total_days += days
        self.hold_started_at = today_str()
        
        # 만료일 연장
        try:
            curr_exp = datetime.strptime(self.valid_until, "%Y-%m-%d")
            self.valid_until = (curr_exp + timedelta(days=days)).strftime("%Y-%m-%d")
        except Exception:
            pass
        self.save("held", hold_days=days, new_expiry=self.valid_until)
        return f"이용권이 {days}일간 일시정지되었습니다 (새 만기일: {self.valid_until})."

    def resume(self) -> str:
        if not self.is_held:
            raise ValueError("일시정지 상태가 아닙니다.")
        self.is_held = False
        self.hold_started_at = None
        self.save("resumed")
        return "이용권 일시정지가 해제되었습니다."


# ───────────────────────────── 좌석 ─────────────────────────────
class Seat(Obj):
    scope_field = "branch_id"
    branch_id: str = "studycafe-main"
    seat_number: str = "A-01"       # A-01 ~ A-20
    zone_type: str = "NORMAL"       # 'FOCUS' (집중실), 'NORMAL' (일반실), 'LAPTOP' (노트북존)
    status: str = "EMPTY"           # 'EMPTY', 'OCCUPIED', 'STEP_OUT'
    is_fixed: bool = False          # 고정석 여부
    fixed_name: Optional[str] = None
    fixed_phone: Optional[str] = None

    current_member_id: Optional[str] = None
    current_member_name: Optional[str] = None
    current_member_phone: Optional[str] = None
    current_user_type: str = "GENERAL"
    active_ticket_id: Optional[str] = None
    check_in_at: Optional[str] = None
    step_out_at: Optional[str] = None
    session_id: Optional[str] = None

    def check_in(self, member: Member, ticket: Optional[Ticket] = None) -> "StudySession":
        if self.status != "EMPTY":
            raise ValueError(f"{self.seat_number} 좌석은 이미 사용 중입니다 ({self.current_member_name}님).")
        if self.is_fixed and self.fixed_phone and self.fixed_phone != member.phone:
            raise PermissionError(f"{self.seat_number} 좌석은 {self.fixed_name}님의 전용 고정석입니다.")

        # 22시 청소년 심야 체크
        cur_hour = now_dt().hour
        if member.is_minor and not member.night_exempt and (cur_hour >= 22 or cur_hour < 6):
            raise PermissionError("청소년보호법에 의거 22:00~06:00 심야 시간에는 청소년 입실이 제한됩니다.")

        t = ticket or next(iter(member.active_tickets()), None)
        if not t:
            raise ValueError(f"{member.name}님은 현재 유효한 이용권이 없습니다. 이용권을 먼저 발급해 주세요.")

        now = now_str()
        self.status = "OCCUPIED"
        self.current_member_id = member.id
        self.current_member_name = member.name
        self.current_member_phone = member.phone
        self.current_user_type = member.user_type
        self.active_ticket_id = t.id
        self.check_in_at = now
        self.step_out_at = None

        sess = StudySession(
            branch_id=self.branch_id,
            seat_number=self.seat_number,
            member_id=member.id,
            member_name=member.name,
            member_phone=member.phone,
            ticket_id=t.id,
            ticket_type=t.ticket_type,
            check_in_at=now
        ).save("check_in")

        self.session_id = sess.id
        self.save("occupied", member=member.name)
        return sess

    def check_out(self) -> Dict[str, Any]:
        if self.status == "EMPTY":
            raise ValueError(f"{self.seat_number} 좌석은 이미 비어 있습니다.")

        now = now_str()
        dt_in = datetime.strptime(self.check_in_at, "%Y-%m-%d %H:%M:%S") if self.check_in_at else now_dt()
        duration_mins = max(1, int((now_dt() - dt_in).total_seconds() // 60))

        # 시간권일 경우 잔여 시간 차감
        ticket = Ticket.get(self.active_ticket_id) if self.active_ticket_id else None
        used_mins = 0
        if ticket and ticket.is_time_ticket:
            used_mins = ticket.consume(duration_mins)

        # 세션 마감
        sess = StudySession.get(self.session_id) if self.session_id else None
        if sess:
            sess.check_out_at = now
            sess.duration_minutes = duration_mins
            sess.save("check_out")

        mem_name = self.current_member_name
        self.status = "EMPTY"
        self.current_member_id = None
        self.current_member_name = None
        self.current_member_phone = None
        self.active_ticket_id = None
        self.check_in_at = None
        self.step_out_at = None
        self.session_id = None
        self.save("vacated")

        return {
            "seat_number": self.seat_number,
            "member_name": mem_name,
            "duration_minutes": duration_mins,
            "ticket_deducted": used_mins,
            "message": f"{self.seat_number} 좌석 {mem_name}님 퇴실 완료 (이용시간: {duration_mins}분)"
        }

    def step_out(self) -> str:
        if self.status != "OCCUPIED":
            raise ValueError("이용 중인 좌석만 외출 처리할 수 있습니다.")
        self.status = "STEP_OUT"
        self.step_out_at = now_str()
        self.save("step_out")
        return f"{self.seat_number} 좌석 외출 처리되었습니다 (외출 허용: 90분)."

    def step_in(self) -> str:
        if self.status != "STEP_OUT":
            raise ValueError("외출 중인 좌석만 복귀 처리할 수 있습니다.")
        self.status = "OCCUPIED"
        self.step_out_at = None
        self.save("step_in")
        return f"{self.seat_number} 좌석 복귀 확인되었습니다."

    def card(self) -> Dict[str, Any]:
        return {
            "seat_number": self.seat_number,
            "zone_type": self.zone_type,
            "status": self.status,
            "is_fixed": self.is_fixed,
            "fixed_name": self.fixed_name,
            "current_name": self.current_member_name,
            "current_phone": self.current_member_phone,
            "check_in_at": self.check_in_at,
            "step_out_at": self.step_out_at
        }


# ───────────────────────────── 이용기록 & 결제 ─────────────────────────────
class StudySession(Obj):
    scope_field = "branch_id"
    branch_id: str = "studycafe-main"
    seat_number: str = ""
    member_id: str = ""
    member_name: str = ""
    member_phone: str = ""
    ticket_id: str = ""
    ticket_type: str = ""
    check_in_at: str = ""
    check_out_at: Optional[str] = None
    duration_minutes: int = 0


class Payment(Obj):
    scope_field = "branch_id"
    branch_id: str = "studycafe-main"
    member_name: str = ""
    member_phone: str = ""
    ticket_type: str = ""
    amount: int = 0
    pay_method: str = "신용카드"     # 신용카드, 카카오페이, 현금, 계좌이체
    paid_at: str = Field(default_factory=now_str)
    note: str = ""
