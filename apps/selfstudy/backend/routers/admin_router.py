"""
apps/selfstudy/backend/routers/admin_router.py
MQstudy 관리자 전용 대시보드 라우터 (학생 목록, 관리형/자율형 제어, 상담일지).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import datetime

from shared.core.base_database import get_db
from apps.selfstudy.backend.models import StudyUser, StudyAttendance, StudyChatSession

router = APIRouter()


class UpdateModePayload(BaseModel):
    role: str  # GENERAL (자율형) | MANAGED (관리형)


class ConsultNotePayload(BaseModel):
    session_id: str
    date: str
    consult_note: str
    consult_checked: Optional[bool] = True


@router.get("/students", summary="전체 등록 학생 목록 조회")
async def list_students(
    db: Session = Depends(get_db),
):
    users = db.query(StudyUser).all()
    if not users:
        # 시드 데이터
        seed_users = [
            StudyUser(user_id="010-1111-2222", password="1212", name="관리자", role="ADMIN"),
            StudyUser(user_id="010-1234-5678", password="1234", name="김민수 (고2 수험생)", role="MANAGED"),
            StudyUser(user_id="010-9876-5432", password="1234", name="이영희 (자격증 준비생)", role="GENERAL"),
        ]
        for u in seed_users:
            db.add(u)
        db.commit()
        users = db.query(StudyUser).all()

    return {
        "status": "success",
        "total": len(users),
        "students": [
            {
                "user_id": u.user_id,
                "name": u.name,
                "role": u.role,
                "is_locked": u.is_locked,
                "last_visit_at": str(u.last_visit_at),
            }
            for u in users
        ]
    }


@router.post("/students/{user_id}/mode", summary="학생 모드 변경 (자율형 <-> 관리형)")
async def update_student_mode(
    user_id: str,
    payload: UpdateModePayload,
    db: Session = Depends(get_db),
):
    user = db.query(StudyUser).filter(StudyUser.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="해당 학생을 찾을 수 없습니다.")

    user.role = payload.role
    db.commit()
    return {"status": "success", "user_id": user_id, "role": user.role}


@router.post("/consult", summary="대면 상담 일지 작성 및 승인")
async def save_consult_note(
    payload: ConsultNotePayload,
    db: Session = Depends(get_db),
):
    record = db.query(StudyAttendance).filter(
        StudyAttendance.session_id == payload.session_id,
        StudyAttendance.date == payload.date
    ).first()

    if not record:
        record = StudyAttendance(
            session_id=payload.session_id,
            date=payload.date,
            consult_checked=payload.consult_checked,
            consult_note=payload.consult_note
        )
        db.add(record)
    else:
        record.consult_checked = payload.consult_checked
        record.consult_note = payload.consult_note

    db.commit()
    return {"status": "success", "message": "대면 상담 일지가 성공적으로 저장되었습니다.", "session_id": payload.session_id}
