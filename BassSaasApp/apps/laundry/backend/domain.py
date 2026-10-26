"""
apps/laundry/backend/domain.py — 무인빨래방 도메인 객체.

라우터에는 HTTP 변환만 두고, 상태 전이·요금 검증 같은 규칙은 전부 여기(객체의 행동)에 둔다.

상태 전이:  IDLE ──start()──▶ RUNNING ──(시간 경과 sync)──▶ DONE ──collect()──▶ IDLE
            any ──report_broken()──▶ BROKEN ──repair()──▶ IDLE
"""
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

from core import Conflict, DomainError, Mismatch, NotFound, Obj

# 테스트에서 시간을 고정/이동시킬 수 있도록 시계를 주입 가능하게 둔다.
clock: Callable[[], datetime] = datetime.now

COURSES: Dict[str, Dict[str, Dict[str, Any]]] = {
    "washer": {
        "quick":    {"name": "쾌속 세탁", "minutes": 25, "price": 3000},
        "standard": {"name": "표준 세탁", "minutes": 40, "price": 4000},
        "bedding":  {"name": "이불 세탁", "minutes": 60, "price": 6000},
    },
    "dryer": {
        "dry30": {"name": "건조 30분", "minutes": 30, "price": 3000},
        "dry50": {"name": "건조 50분", "minutes": 50, "price": 4500},
    },
}
TYPE_LABEL = {"washer": "세탁기", "dryer": "건조기"}


def won(n: int) -> str:
    return f"{n:,}원"


def _parse(ts: str) -> Optional[datetime]:
    return datetime.fromisoformat(ts) if ts else None


class Payment(Obj):
    label = "결제"
    scope_field = "branch_id"

    branch_id: str = "main"
    machine_no: str
    course: str
    course_name: str
    amount: int
    phone: str = ""
    paid_at: str = ""

    def summary(self) -> str:
        return f"{self.machine_no} {self.course_name} {won(self.amount)}"

    @classmethod
    def sales_on(cls, day: str, branch_id: str = "main") -> Dict[str, Any]:
        rows = [p for p in cls.find(branch_id) if p.paid_at.startswith(day)]
        return {"date": day, "count": len(rows), "amount": sum(p.amount for p in rows)}


class Machine(Obj):
    label = "장비"
    scope_field = "branch_id"

    branch_id: str = "main"
    machine_no: str                    # W-01 / D-01
    machine_type: str = "washer"       # washer | dryer
    status: str = "IDLE"               # IDLE | RUNNING | DONE | BROKEN
    course: str = ""
    course_name: str = ""
    started_at: str = ""
    ends_at: str = ""
    phone: str = ""
    broken_reason: str = ""

    # ── 조회 ──
    @classmethod
    def by_no(cls, machine_no: str, branch_id: str = "main") -> "Machine":
        m = cls.first(branch_id, machine_no=machine_no.upper())
        if not m:
            raise NotFound(f"{machine_no} 장비를 찾을 수 없습니다.", hint="장비 번호(W-01, D-01 형식)를 확인해 주세요.")
        return m.sync()

    @classmethod
    def board(cls, branch_id: str = "main") -> List["Machine"]:
        return sorted((m.sync() for m in cls.find(branch_id)), key=lambda m: (m.machine_type != "washer", m.machine_no))

    @property
    def remaining_minutes(self) -> int:
        end = _parse(self.ends_at)
        if self.status != "RUNNING" or not end:
            return 0
        return max(0, int((end - clock()).total_seconds() + 59) // 60)

    # ── 시간 경과 반영 (가짜 '가동 중' 방지) ──
    def sync(self) -> "Machine":
        end = _parse(self.ends_at)
        if self.status == "RUNNING" and end and clock() >= end:
            self.status = "DONE"
            self.save("cycle_finished", summary=f"{self.machine_no} {self.course_name} 완료")
        return self

    # ── 행동 ──
    def start(self, course: str, paid: int, phone: str = "") -> Payment:
        self.sync()
        if self.status == "BROKEN":
            raise DomainError(f"{self.machine_no}는 점검 중입니다.", level="error",
                              hint=f"사유: {self.broken_reason or '미기재'} · 다른 장비를 이용해 주세요.")
        if self.status == "RUNNING":
            raise Conflict(f"{self.machine_no}는 이미 가동 중입니다.",
                           hint=f"약 {self.remaining_minutes}분 후 완료됩니다. 다른 장비를 선택해 주세요.")
        if self.status == "DONE":
            raise Conflict(f"{self.machine_no}에 수거하지 않은 세탁물이 있습니다.",
                           hint="세탁물을 꺼낸 뒤 [수거 완료]를 눌러 주세요.")

        spec = COURSES.get(self.machine_type, {}).get(course)
        if not spec:
            allowed = ", ".join(f"{k}({v['name']})" for k, v in COURSES.get(self.machine_type, {}).items())
            raise DomainError(f"{TYPE_LABEL.get(self.machine_type, '장비')}에서 사용할 수 없는 코스입니다: {course}",
                              hint=f"선택 가능: {allowed}")
        price = int(spec["price"])
        if paid != price:
            gap = price - paid
            raise Mismatch(
                f"투입 금액 {won(paid)}이 요금 {won(price)}보다 {won(abs(gap))} {'부족' if gap > 0 else '많습니다'}.",
                hint=f"{spec['name']} 요금은 {won(price)}입니다. 정확한 금액으로 다시 결제해 주세요.",
                expected=price, received=paid, difference=gap)

        now = clock()
        self.status = "RUNNING"
        self.course, self.course_name = course, spec["name"]
        self.started_at = now.isoformat(timespec="seconds")
        self.ends_at = (now + timedelta(minutes=int(spec["minutes"]))).isoformat(timespec="seconds")
        self.phone = phone
        self.save("started", summary=f"{self.machine_no} {spec['name']} 시작")
        return Payment(branch_id=self.branch_id, machine_no=self.machine_no, course=course,
                       course_name=spec["name"], amount=price, phone=phone,
                       paid_at=self.started_at).save("paid")

    def collect(self) -> None:
        self.sync()
        if self.status == "RUNNING":
            raise Conflict(f"{self.machine_no}는 아직 가동 중입니다.", hint=f"약 {self.remaining_minutes}분 남았습니다.")
        if self.status != "DONE":
            raise Conflict(f"{self.machine_no}에는 수거할 세탁물이 없습니다.", hint="이미 비어 있는 장비입니다.")
        self._reset()
        self.save("collected")

    def report_broken(self, reason: str) -> None:
        if self.status == "BROKEN":
            raise Conflict(f"{self.machine_no}는 이미 점검 중으로 등록되어 있습니다.")
        self.status, self.broken_reason = "BROKEN", reason.strip() or "사유 미기재"
        self.save("broken", summary=f"{self.machine_no} 점검 등록: {self.broken_reason}")

    def repair(self) -> None:
        if self.status != "BROKEN":
            raise Conflict(f"{self.machine_no}는 점검 중이 아닙니다.")
        self._reset()
        self.save("repaired")

    def _reset(self) -> None:
        self.status, self.course, self.course_name = "IDLE", "", ""
        self.started_at = self.ends_at = self.phone = self.broken_reason = ""

    # ── 표현 ──
    def summary(self) -> str:
        return f"{self.machine_no} {TYPE_LABEL.get(self.machine_type, '')} [{self.status}]"

    def card(self) -> Dict[str, Any]:
        return {
            "machine_no": self.machine_no, "machine_type": self.machine_type,
            "type_label": TYPE_LABEL.get(self.machine_type, self.machine_type),
            "status": self.status, "course": self.course, "course_name": self.course_name,
            "started_at": self.started_at, "ends_at": self.ends_at,
            "remaining_minutes": self.remaining_minutes, "broken_reason": self.broken_reason,
            "phone_tail": self.phone[-4:] if self.phone else "",
        }


def seed(branch_id: str = "main") -> int:
    """장비가 하나도 없을 때만 세탁기 6대 + 건조기 3대를 만든다."""
    if Machine.count(branch_id):
        return 0
    for i in range(1, 7):
        Machine(branch_id=branch_id, machine_no=f"W-{i:02d}", machine_type="washer").save("seeded")
    for i in range(1, 4):
        Machine(branch_id=branch_id, machine_no=f"D-{i:02d}", machine_type="dryer").save("seeded")
    return 9


def branch_stats(branch_id: str = "main") -> Dict[str, Any]:
    board = Machine.board(branch_id)
    by_status: Dict[str, int] = {}
    for m in board:
        by_status[m.status] = by_status.get(m.status, 0) + 1
    return {"machines": len(board), "by_status": by_status,
            "today_sales": Payment.sales_on(clock().date().isoformat(), branch_id)}
