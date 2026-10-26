"""
domain/__init__.py — 셀프스터디2 도메인 패키지 초기화.
"""
import os
from typing import Any, Optional
from ..kernel import agent, identity
from ..kernel.base import store, use_store
from ..kernel.identity import seed_users
from . import ai_tools  # noqa: F401
from .selfstudy import Center, Student, Attendance, Consultation, StudyPlan

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_DB_PATH = os.path.join(ROOT, "data", "selfstudy2.db")

DEFAULT_USERS = [
    ("admin", "본사 최고관리자", "superadmin", None),
    ("admin01", "독서실 총괄실장", "branch_admin", "selfstudy-main"),
    ("student", "관리형 수험생", "student", "selfstudy-main"),
    ("parent", "학부모", "parent", "selfstudy-main"),
]

_ready = False

def bootstrap(db_path: Optional[str] = None) -> None:
    global _ready
    if _ready:
        return
    resolved_path = db_path or os.getenv("SELFSTUDY2_DB") or DEFAULT_DB_PATH
    use_store(resolved_path)
    seed_users(DEFAULT_USERS)

    c = Center.require("selfstudy-main")
    if not Student.find("selfstudy-main"):
        # 샘플 수험생 5명 시드
        s1 = Student(center_id="selfstudy-main", name="강민석", phone="010-7777-1111", target_exam="수능(의대목표)", assigned_seat="S-01", target_study_hours=12, parent_phone="010-9000-1111").save("seeded")
        s2 = Student(center_id="selfstudy-main", name="이지은", phone="010-7777-2222", target_exam="9급 국가직 공무원", assigned_seat="S-02", target_study_hours=10, parent_phone="010-9000-2222").save("seeded")
        s3 = Student(center_id="selfstudy-main", name="윤도현", phone="010-7777-3333", target_exam="경찰공무원(순경)", assigned_seat="S-03", target_study_hours=10, parent_phone="010-9000-3333").save("seeded")
        s4 = Student(center_id="selfstudy-main", name="최수빈", phone="010-7777-4444", target_exam="수능(정시 인문)", assigned_seat="S-04", target_study_hours=10, parent_phone="010-9000-4444").save("seeded")
        s5 = Student(center_id="selfstudy-main", name="한재원", phone="010-7777-5555", target_exam="공인회계사(CPA)", assigned_seat="S-05", target_study_hours=11, parent_phone="010-9000-5555").save("seeded")

        # 오늘 출결 상태 시드
        # 강민석: 08:15 등원 (정시, 열공 중)
        s1.status = "학습중"
        s1.save("seeded")
        Attendance(center_id="selfstudy-main", student_id=s1.id, student_name=s1.name, student_phone=s1.phone, seat_number="S-01", check_in_at="08:15:00", study_minutes=180).save("seeded")

        # 이지은: 08:25 등원 (정시, 열공 중)
        s2.status = "학습중"
        s2.save("seeded")
        Attendance(center_id="selfstudy-main", student_id=s2.id, student_name=s2.name, student_phone=s2.phone, seat_number="S-02", check_in_at="08:25:00", study_minutes=170).save("seeded")

        # 윤도현: 08:45 등원 (지각), 현재 열공 중
        s3.status = "학습중"
        s3.save("seeded")
        Attendance(center_id="selfstudy-main", student_id=s3.id, student_name=s3.name, student_phone=s3.phone, seat_number="S-03", check_in_at="08:45:00", is_late=True, study_minutes=150).save("seeded")

        # 최수빈: 미등원
        s4.status = "미등원"
        s4.save("seeded")

        # 한재원: 08:20 등원 후 12:00 조기 하원 (오후 시험 대비)
        s5.status = "귀가"
        s5.save("seeded")
        Attendance(center_id="selfstudy-main", student_id=s5.id, student_name=s5.name, student_phone=s5.phone, seat_number="S-05", check_in_at="08:20:00", check_out_at="12:00:00", study_minutes=220).save("seeded")

        # 샘플 상담일지 시드
        Consultation(center_id="selfstudy-main", student_id=s1.id, student_name=s1.name, attitude_score=5, focus_rating="우수", notes="수능 수학 킬러 문항 풀이 집중도 최상 유지. 졸음 없음.").save("seeded")
        Consultation(center_id="selfstudy-main", student_id=s3.id, student_name=s3.name, attitude_score=3, focus_rating="집중필요", notes="오전 기상 지각 15분 발생. 취침 루틴 12시 이전으로 재조정 지도.").save("seeded")

    _ready = True


def ask(message: str, user: identity.User, center: str = "selfstudy-main", mode: str = "auto") -> dict:
    ctx = {"center": center}
    return agent.chat(message, user, ctx, ai_tools.system_prompt(user), mode)
