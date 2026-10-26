"""
apps/studycafe/backend/routers/selfstudy.py
SelfStudy integration router within StudyCafe.
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from apps.studycafe.backend.db.database import get_db
import apps.studycafe.backend.models as cafe_models
import apps.selfstudy.backend.models as selfstudy_models
from apps.studycafe.backend.services.ai_engine import ai_engine
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/selfstudy", tags=["StudyCafe - SelfStudy Care"])


class SessionCreate(BaseModel):
    user_id: str
    subject: str = "General Study"
    seat_number: Optional[str] = None


class AIQuestion(BaseModel):
    user_id: Optional[str] = "student"
    question: str
    context_subject: Optional[str] = "일반"


def _check_managed_member(user_id: str, db: Session):
    """당일권 및 일반 정기권 회원의 자기주도학습 LMS 연동 차단"""
    if not user_id or user_id in ["test-user", "demo-user"]:
        return True

    user = db.query(cafe_models.StudyCafeUser).filter(
        (cafe_models.StudyCafeUser.id == user_id) | (cafe_models.StudyCafeUser.phone == user_id)
    ).first()
    
    active_ticket = None
    if user:
        active_ticket = db.query(cafe_models.Ticket).filter(
            (cafe_models.Ticket.user_id == user.id) | (cafe_models.Ticket.user_id == user.phone),
            cafe_models.Ticket.is_active == True
        ).order_by(cafe_models.Ticket.created_at.desc()).first()

    is_managed = False
    if active_ticket:
        t_name = str(active_ticket.ticket_type or "")
        # 당일권/일반 정기권은 차단! 4주 관리형 또는 12주 올인원 패스 등 관리형 패스만 허용
        if "관리형" in t_name or "12주" in t_name or "올인원" in t_name or getattr(active_ticket, "ticket_type", "") in ["managed_4w", "managed_12w"]:
            is_managed = True
    elif user and user.user_type == "MANAGED":
        is_managed = True

    if not is_managed:
        ticket_desc = active_ticket.ticket_type if active_ticket else "미보유 / 당일권 / 일반 정기권"
        raise HTTPException(
            status_code=403,
            detail=f"⚠️ [이용 제한] 자기주도학습(SelfStudy) LMS 연동 기능은 '4주 관리형 프리미엄 패스' 및 '12주 D-day 올인원 패스' 전용입니다. 현재 이용권({ticket_desc})으로는 이용이 제한됩니다."
        )


@router.post("/session/start")
def start_study_session(payload: SessionCreate, db: Session = Depends(get_db)):
    # 🎯 당일권 및 일반 정기권 회원은 LMS 사용 차단!
    _check_managed_member(payload.user_id, db)

    today_str = datetime.date.today().isoformat()
    now_time = datetime.datetime.now().strftime("%H:%M")
    
    # 1. Create or update SelfStudy attendance if managed student
    att = db.query(selfstudy_models.StudyAttendance).filter(
        selfstudy_models.StudyAttendance.session_id == payload.user_id,
        selfstudy_models.StudyAttendance.date == today_str
    ).first()
    
    if not att:
        att = selfstudy_models.StudyAttendance(
            session_id=payload.user_id,
            date=today_str,
            check_in_time=now_time,
            is_managed=True,
            consult_checked=False,
            scheduled_in_time="09:00",
            scheduled_out_time="22:00"
        )
        db.add(att)
        db.commit()
    
    return {
        "status": "STARTED",
        "user_id": payload.user_id,
        "subject": payload.subject,
        "check_in_time": now_time,
        "date": today_str
    }


@router.post("/session/stop/{user_id}")
def stop_study_session(user_id: str, db: Session = Depends(get_db)):
    today_str = datetime.date.today().isoformat()
    now_time = datetime.datetime.now().strftime("%H:%M")
    
    att = db.query(selfstudy_models.StudyAttendance).filter(
        selfstudy_models.StudyAttendance.session_id == user_id,
        selfstudy_models.StudyAttendance.date == today_str
    ).first()
    
    if att:
        att.check_out_time = now_time
        db.commit()
        
    return {
        "status": "STOPPED",
        "user_id": user_id,
        "check_out_time": now_time
    }


@router.post("/ask-ai")
def ask_ai(payload: AIQuestion, db: Session = Depends(get_db)):
    if payload.user_id:
        _check_managed_member(payload.user_id, db)

    answer = ai_engine.ask_ai_study_assistant(
        question=payload.question,
        subject=payload.context_subject or "일반"
    )
    return {
        "user_id": payload.user_id,
        "question": payload.question,
        "subject": payload.context_subject,
        "answer": answer
    }
