"""
backend/api.py — 셀프스터디2 (관리형 독서실) FastAPI 라우터.
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from .domain import Center, Student, Attendance, Consultation, StudyPlan, ask, bootstrap
from .kernel.identity import User

router = APIRouter()
bootstrap()


def me(authorization: str = Header("")) -> User:
    u = User.from_token(authorization)
    if not u:
        u = User.by_username("admin")
    if not u:
        u = User(username="admin", name="관리자", role="superadmin")
    return u


@router.get("/status")
def status(center_id: str = "selfstudy-main"):
    c = Center.require(center_id)
    return {"app_id": "selfstudy2", "app_name": "관리형 독서실/셀프스터디 (객체 도메인 모델)", "status": "HEALTHY", **c.stats()}


@router.get("/students")
def list_students(center_id: str = "selfstudy-main"):
    c = Center.require(center_id)
    return {"success": True, "students": [s.card() for s in c.students()]}


@router.post("/students")
def create_student(payload: Dict[str, Any] = Body(...), center_id: str = "selfstudy-main"):
    phone = payload.get("phone", "").strip()
    name = payload.get("name", "").strip()
    if not phone or not name:
        raise HTTPException(400, "학생 이름과 전화번호는 필수입니다.")
    s = Student(
        center_id=center_id,
        phone=phone,
        name=name,
        target_exam=payload.get("target_exam", "수능"),
        assigned_seat=payload.get("assigned_seat", "S-01"),
        parent_phone=payload.get("parent_phone", "")
    ).save("registered")
    return {"success": True, "student": s.card()}


@router.post("/students/{phone}/check-in")
def check_in(phone: str, center_id: str = "selfstudy-main"):
    s = Student.by_phone(phone, center_id)
    if not s:
        raise HTTPException(404, "학생을 찾을 수 없습니다.")
    try:
        att = s.check_in()
        return {"success": True, "message": f"{s.name} 학생 등원 완료 ({att.check_in_at})", "student": s.card()}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/students/{phone}/check-out")
def check_out(phone: str, center_id: str = "selfstudy-main"):
    s = Student.by_phone(phone, center_id)
    if not s:
        raise HTTPException(404, "학생을 찾을 수 없습니다.")
    try:
        att = s.check_out()
        return {"success": True, "message": f"{s.name} 학생 하원 완료 ({att.check_out_at}) - 순공 {round(att.study_minutes/60, 1)}시간", "student": s.card()}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/consultations")
def list_consultations(center_id: str = "selfstudy-main"):
    cs = Consultation.find(center_id)
    return {"success": True, "total": len(cs), "consultations": [c.model_dump() for c in sorted(cs, key=lambda x: x.date, reverse=True)]}


@router.post("/consultations")
def create_consultation(payload: Dict[str, Any] = Body(...), center_id: str = "selfstudy-main"):
    name = payload.get("student_name", "").strip()
    notes = payload.get("notes", "").strip()
    rating = payload.get("focus_rating", "우수")
    from .domain.ai_tools import log_consultation
    res = log_consultation(name_or_phone=name, notes=notes, focus_rating=rating, center=center_id)
    return {"success": True, **res}


@router.post("/ai/chat")
def ai_chat(payload: Dict[str, Any] = Body(...), user: User = Depends(me)):
    msg = (payload.get("message") or "").strip()
    if not msg:
        raise HTTPException(400, "질문 내용을 입력해 주세요.")
    return ask(msg, user, payload.get("center") or "selfstudy-main", payload.get("mode") or "auto")
