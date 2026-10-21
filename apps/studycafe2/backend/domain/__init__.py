"""
domain/__init__.py — 스터디카페 도메인 패키지 초기화.
"""
from typing import Any, Optional
from ..kernel import agent, identity
from ..kernel.base import store, use_store
from ..kernel.identity import seed_users
from . import ai_tools  # noqa: F401
from .studycafe import Branch, Seat, Member, Ticket, StudySession, Payment

DEFAULT_USERS = [
    ("admin", "본사 최고관리자", "superadmin", None),
    ("admin01", "스터디카페 점주실장", "branch_admin", "studycafe-main"),
    ("student", "일반 수험생", "student", "studycafe-main"),
]

_ready = False

def bootstrap(db_path: str = "apps/studycafe2/data/studycafe2.db") -> None:
    global _ready
    if _ready:
        return
    use_store(db_path)
    seed_users(DEFAULT_USERS)

    b = Branch.require("studycafe-main")
    if not Seat.find("studycafe-main"):
        # A-01 ~ A-20 좌석 시드
        for i in range(1, 21):
            s_num = f"A-{str(i).zfill(2)}"
            zone = "FOCUS" if i <= 6 else ("LAPTOP" if i >= 17 else "NORMAL")
            Seat(
                branch_id="studycafe-main",
                seat_number=s_num,
                zone_type=zone,
                status="EMPTY"
            ).save("seeded")

        # 샘플 회원 3명 시드
        m1 = Member(branch_id="studycafe-main", name="김민우", phone="010-3333-1111", user_type="MANAGED", is_minor=True, parent_phone="010-9999-8888").save("seeded")
        m2 = Member(branch_id="studycafe-main", name="박서연", phone="010-4444-2222", user_type="GENERAL", is_minor=False).save("seeded")
        m3 = Member(branch_id="studycafe-main", name="이진호", phone="010-5555-3333", user_type="GENERAL", is_minor=False).save("seeded")

        # 샘플 이용권 시드
        Ticket(branch_id="studycafe-main", member_id=m1.id, member_name=m1.name, member_phone=m1.phone, ticket_type="4주 관리형", is_time_ticket=False, valid_until="2026-11-20", price=250000).save("seeded")
        Ticket(branch_id="studycafe-main", member_id=m2.id, member_name=m2.name, member_phone=m2.phone, ticket_type="50시간권", is_time_ticket=True, total_minutes=3000, remaining_minutes=2500, price=70000).save("seeded")
        t3 = Ticket(branch_id="studycafe-main", member_id=m3.id, member_name=m3.name, member_phone=m3.phone, ticket_type="4시간권", is_time_ticket=True, total_minutes=240, remaining_minutes=240, price=7000).save("seeded")

        # 1~2개 좌석 이용 중 상태 시드
        s1 = next((s for s in Seat.find("studycafe-main") if s.seat_number == "A-01"), None)
        if s1:
            s1.check_in(m1)

        s2 = next((s for s in Seat.find("studycafe-main") if s.seat_number == "A-07"), None)
        if s2:
            s2.check_in(m2)
            s2.step_out()  # 외출 중

    _ready = True


def ask(message: str, user: identity.User, branch: str = "studycafe-main", mode: str = "auto") -> dict:
    ctx = {"branch": branch}
    return agent.chat(message, user, ctx, ai_tools.system_prompt(user), mode)
