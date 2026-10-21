"""
domain/selfstudy.py — 관리형 독서실/셀프스터디 도메인 객체 (OOP Domain-Driven Design).

  Center(센터)  Student(학생)  Attendance(출결/순공)  Consultation(상담일지)  StudyPlan(학습플랜)  StudyMessage(3자메시지)

핵심 설계: 테이블 조인 대신 도메인 객체가 당일 순공시간 계산, 지각 판정, 주간 상담 누적, 학부모 안심 리포트를 스스로 계산한다.
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


def parse_time_str(d: str, t: str) -> Optional[datetime]:
    if not t:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(f"{d} {t.strip()}", fmt)
        except ValueError:
            pass
    return None


# ───────────────────────────── 센터 ─────────────────────────────
class Center(Obj):
    scope_field = "id"
    name: str = "MQ 관리형 독서실 강남본원"
    address: str = "서울특별시 강남구 테헤란로 123 4층"
    contact_phone: str = "010-2345-6789"
    standard_in_time: str = "08:30"   # 정규 의무 등원 시각 (이후 지각)
    standard_out_time: str = "22:00"  # 정규 의무 하원 시각
    daily_target_minutes: int = 600   # 일일 목표 순공 시간 (10시간)

    @classmethod
    def require(cls, ref: Optional[str] = None) -> "Center":
        ref = (ref or "selfstudy-main").strip()
        c = cls.get(ref) or next((c for c in cls.all() if ref.lower() in c.name.lower()), None)
        if not c:
            c = cls(id="selfstudy-main").save("seeded")
        return c

    def students(self) -> List["Student"]:
        return sorted(Student.find(self.id), key=lambda s: s.name)

    def stats(self, target_date: Optional[str] = None) -> Dict[str, Any]:
        d = target_date or today_str()
        studs = self.students()
        atts = Attendance.find(self.id, date=d)
        att_map = {a.student_id: a for a in atts}

        in_study = 0
        left = 0
        absent = 0
        total_pure_study_mins = 0

        for s in studs:
            a = att_map.get(s.id)
            if not a or not a.check_in_at:
                absent += 1
            elif a.check_in_at and not a.check_out_at:
                in_study += 1
                dt_in = parse_time_str(d, a.check_in_at)
                if dt_in:
                    mins = max(1, int((now_dt() - dt_in).total_seconds() // 60))
                    total_pure_study_mins += mins
            else:
                left += 1
                total_pure_study_mins += a.study_minutes

        return {
            "center_id": self.id,
            "center_name": self.name,
            "date": d,
            "total_students": len(studs),
            "studying_count": in_study,
            "checked_out_count": left,
            "absent_count": absent,
            "attendance_rate": round((len(studs) - absent) / len(studs) * 100, 1) if studs else 0,
            "total_study_hours": round(total_pure_study_mins / 60, 1)
        }


# ───────────────────────────── 학생 ─────────────────────────────
class Student(Obj):
    scope_field = "center_id"
    center_id: str = "selfstudy-main"
    phone: str = ""                # 010-1234-5678 (고유 식별자)
    name: str = ""
    target_exam: str = "수능(정시)" # 수능, 9급 공무원, 경찰, 소방, 전문자격
    assigned_seat: str = "S-01"    # 지정 고정석
    target_study_hours: int = 10   # 목표 순공시간 (10시간)
    parent_phone: str = ""         # 학부모 연락처
    status: str = "귀가"           # '학습중', '외출', '귀가', '미등원'
    pin_code: str = "0000"

    @classmethod
    def by_phone(cls, phone: str, center_id: str = "selfstudy-main") -> Optional["Student"]:
        clean = phone.replace("-", "").replace(" ", "").strip()
        for s in cls.find(center_id):
            if s.phone.replace("-", "").replace(" ", "").strip() == clean:
                return s
        return None

    def today_attendance(self, d: Optional[str] = None) -> "Attendance":
        day = d or today_str()
        a = next((a for a in Attendance.find(self.center_id, student_id=self.id, date=day)), None)
        if not a:
            a = Attendance(center_id=self.center_id, student_id=self.id, student_name=self.name,
                           student_phone=self.phone, seat_number=self.assigned_seat, date=day).save("created")
        return a

    def check_in(self) -> "Attendance":
        a = self.today_attendance()
        if a.check_in_at and not a.check_out_at:
            raise ValueError(f"{self.name} 학생은 이미 {a.check_in_at}에 등원 처리되어 있습니다.")

        cur_time = now_dt().strftime("%H:%M:%S")
        is_late = cur_time > "08:30:59"
        a.check_in_at = cur_time
        a.is_late = is_late
        a.check_out_at = None
        a.save("check_in")

        self.status = "학습중"
        self.save("status_updated")
        return a

    def check_out(self) -> "Attendance":
        a = self.today_attendance()
        if not a.check_in_at:
            raise ValueError(f"{self.name} 학생은 오늘 등원 기록이 없습니다.")
        if a.check_out_at:
            raise ValueError(f"{self.name} 학생은 이미 {a.check_out_at}에 하원 처리되었습니다.")

        cur_time = now_dt().strftime("%H:%M:%S")
        a.check_out_at = cur_time

        # 순공시간 계산
        d_in = parse_time_str(a.date, a.check_in_at)
        d_out = parse_time_str(a.date, cur_time)
        if d_in and d_out:
            mins = max(1, int((d_out - d_in).total_seconds() // 60))
            a.study_minutes += mins

        a.save("check_out")
        self.status = "귀가"
        self.save("status_updated")
        return a

    def card(self, target_date: Optional[str] = None) -> Dict[str, Any]:
        d = target_date or today_str()
        a = self.today_attendance(d)
        curr_mins = a.study_minutes
        if a.check_in_at and not a.check_out_at:
            d_in = parse_time_str(d, a.check_in_at)
            if d_in:
                curr_mins += max(0, int((now_dt() - d_in).total_seconds() // 60))

        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "target_exam": self.target_exam,
            "assigned_seat": self.assigned_seat,
            "status": self.status,
            "check_in_at": a.check_in_at or "-",
            "check_out_at": a.check_out_at or "-",
            "pure_study_hours": round(curr_mins / 60, 1),
            "is_late": a.is_late
        }


# ───────────────────────────── 출결 / 순공시간 ─────────────────────────────
class Attendance(Obj):
    scope_field = "center_id"
    center_id: str = "selfstudy-main"
    student_id: str = ""
    student_name: str = ""
    student_phone: str = ""
    seat_number: str = ""
    date: str = Field(default_factory=today_str)  # YYYY-MM-DD
    check_in_at: Optional[str] = None             # HH:MM:SS
    check_out_at: Optional[str] = None            # HH:MM:SS
    study_minutes: int = 0
    is_late: bool = False
    consult_checked: bool = False


# ───────────────────────────── 상담 일지 ─────────────────────────────
class Consultation(Obj):
    scope_field = "center_id"
    center_id: str = "selfstudy-main"
    student_id: str = ""
    student_name: str = ""
    consultant: str = "담임 실장"
    date: str = Field(default_factory=today_str)
    attitude_score: int = 5                        # 1~5점 (학습 태도)
    focus_rating: str = "우수"                     # 우수, 양호, 집중필요, 졸음주의
    notes: str = ""                                # 상담 피드백 및 지도 사항
    parent_alert_sent: bool = False                # 학부모 전송 여부


# ───────────────────────────── 학습 플랜 ─────────────────────────────
class StudyPlan(Obj):
    scope_field = "center_id"
    center_id: str = "selfstudy-main"
    student_id: str = ""
    subject: str = "국어"                         # 국어, 수학, 영어, 탐구
    textbook: str = "수능특강 2027"
    target_pages: str = "1~50페이지"
    daily_goal_minutes: int = 120
    is_completed: bool = False
    progress_rate: int = 0                         # 0 ~ 100%


# ───────────────────────────── 3자 안심 메시지 ─────────────────────────────
class StudyMessage(Obj):
    scope_field = "center_id"
    center_id: str = "selfstudy-main"
    student_id: str = ""
    sender: str = "center"                         # 'center' | 'student' | 'parent'
    sender_name: str = "관리실"
    content: str = ""
    created_at: str = Field(default_factory=now_str)
