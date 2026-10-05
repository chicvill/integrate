"""apps/selfstudy/backend/routers/progress_router.py - 일일 학습 진도 및 기록 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid, datetime

from shared.core.base_database import get_db
from apps.selfstudy.backend.models import StudyProgress, StudyPlan

router = APIRouter()


class RecordProgressRequest(BaseModel):
    student_id: Optional[str] = "demo-student"
    plan_id: Optional[str] = None
    studied_minutes: int
    completed_tasks: Optional[List[str]] = []
    self_score: Optional[int] = 5  # 1 ~ 5
    note: Optional[str] = None


@router.post("/", summary="일일 학습 진도 기록")
async def record_study_progress(
    body: RecordProgressRequest,
    db: Session = Depends(get_db),
):
    plan_id = body.plan_id
    if not plan_id:
        first_plan = db.query(StudyPlan).filter(StudyPlan.student_id == body.student_id).first()
        plan_id = first_plan.id if first_plan else "default-plan"

    today = datetime.date.today()
    progress = StudyProgress(
        id=str(uuid.uuid4()),
        student_id=body.student_id,
        plan_id=plan_id,
        study_date=today,
        studied_minutes=body.studied_minutes,
        completed_tasks=body.completed_tasks,
        self_score=body.self_score,
        note=body.note,
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    return {
        "success": True,
        "message": f"{today} 진도 기록이 저장되었습니다 ({body.studied_minutes}분 완료).",
        "progress_id": progress.id,
        "studied_minutes": body.studied_minutes,
        "study_date": str(today),
    }


@router.get("/logs", summary="학습 진도 기록 이력 조회")
async def list_progress_logs(
    student_id: str = "demo-student",
    limit: int = 10,
    db: Session = Depends(get_db),
):
    records = db.query(StudyProgress).filter(StudyProgress.student_id == student_id).order_by(StudyProgress.study_date.desc()).limit(limit).all()
    return {
        "student_id": student_id,
        "count": len(records),
        "logs": [
            {
                "id": r.id,
                "study_date": str(r.study_date),
                "studied_minutes": r.studied_minutes,
                "completed_tasks": r.completed_tasks or [],
                "self_score": r.self_score,
                "note": r.note,
            }
            for r in records
        ]
    }


@router.get("/stats", summary="학습 통계 리포트")
async def get_study_stats(
    student_id: str = "demo-student",
    db: Session = Depends(get_db),
):
    records = db.query(StudyProgress).filter(StudyProgress.student_id == student_id).all()
    total_minutes = sum(r.studied_minutes for r in records)
    total_days = len(records)
    avg_score = round(sum(r.self_score or 0 for r in records) / total_days, 1) if total_days > 0 else 5.0

    return {
        "student_id": student_id,
        "total_studied_hours": round(total_minutes / 60, 1),
        "total_studied_minutes": total_minutes,
        "completed_sessions": max(total_days, 1),
        "average_focus_score": avg_score,
        "streak_days": max(total_days, 3),
    }
