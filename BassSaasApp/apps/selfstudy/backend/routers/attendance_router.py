"""
apps/selfstudy/backend/routers/attendance_router.py
MQstudy 출결 관리, 학부모 참관 대시보드 & 대면 상담 라우터.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import datetime

from shared.core.base_database import get_db
from apps.selfstudy.backend.models import StudyAttendance, StudyChatSession, StudyUser

router = APIRouter()


class SaveAttendancePayload(BaseModel):
    session_id: str
    date: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    is_managed: Optional[bool] = False
    consult_checked: Optional[bool] = False
    consult_note: Optional[str] = ""
    scheduled_in_time: Optional[str] = "09:00"
    scheduled_out_time: Optional[str] = "22:00"


@router.get("/parent/{session_id}/summary", summary="학부모 참관 대시보드 실시간 요약")
async def get_parent_summary(
    session_id: str,
    db: Session = Depends(get_db),
):
    session = db.query(StudyChatSession).filter(StudyChatSession.session_id == session_id).first()
    today_str = datetime.date.today().strftime("%Y-%m-%d")

    attendance = db.query(StudyAttendance).filter(
        StudyAttendance.session_id == session_id,
        StudyAttendance.date == today_str
    ).first()

    schedule = session.draft_schedule if session else None

    # 계산: 오늘 완료된 과제 수 및 성취율
    total_tasks = 0
    completed_tasks = 0
    if schedule:
        for week in schedule.get("curriculum", []):
            for task in week.get("daily_tasks", []):
                if task.get("date") == today_str:
                    total_tasks += 1
                    if task.get("completed"):
                        completed_tasks += 1

    completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 100.0

    return {
        "status": "success",
        "session_id": session_id,
        "date": today_str,
        "completion_rate": completion_rate,
        "completed_tasks_count": completed_tasks,
        "total_tasks_count": total_tasks,
        "attendance": {
            "check_in_time": attendance.check_in_time if attendance else "10:00",
            "check_out_time": attendance.check_out_time if attendance else None,
            "is_managed": attendance.is_managed if attendance else True,
            "consult_checked": attendance.consult_checked if attendance else False,
            "consult_note": attendance.consult_note if attendance else ""
        },
        "schedule": schedule
    }


@router.get("/attendance/{session_id}", summary="출결 기록 조회")
async def get_attendance_history(
    session_id: str,
    db: Session = Depends(get_db),
):
    records = db.query(StudyAttendance).filter(StudyAttendance.session_id == session_id).order_by(StudyAttendance.date.desc()).all()
    return {
        "status": "success",
        "session_id": session_id,
        "count": len(records),
        "history": [
            {
                "id": r.id,
                "date": r.date,
                "check_in_time": r.check_in_time,
                "check_out_time": r.check_out_time,
                "is_managed": r.is_managed,
                "consult_checked": r.consult_checked,
                "consult_note": r.consult_note,
            }
            for r in records
        ]
    }


@router.post("/attendance", summary="출결 기록 저장 및 대면 상담 일지 입력")
async def save_attendance(
    payload: SaveAttendancePayload,
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
            check_in_time=payload.check_in_time,
            check_out_time=payload.check_out_time,
            is_managed=payload.is_managed,
            consult_checked=payload.consult_checked,
            consult_note=payload.consult_note,
            scheduled_in_time=payload.scheduled_in_time,
            scheduled_out_time=payload.scheduled_out_time,
        )
        db.add(record)
    else:
        if payload.check_in_time:
            record.check_in_time = payload.check_in_time
        if payload.check_out_time:
            record.check_out_time = payload.check_out_time
        record.is_managed = payload.is_managed
        record.consult_checked = payload.consult_checked
        if payload.consult_note:
            record.consult_note = payload.consult_note

    db.commit()
    return {"status": "success", "message": "출결 및 상담 기록이 저장되었습니다.", "session_id": payload.session_id}
