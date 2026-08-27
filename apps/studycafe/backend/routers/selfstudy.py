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


@router.post("/session/start")
def start_study_session(payload: SessionCreate, db: Session = Depends(get_db)):
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
def ask_ai(payload: AIQuestion):
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
