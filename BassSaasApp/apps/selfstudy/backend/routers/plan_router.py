"""apps/selfstudy/backend/routers/plan_router.py - 자기주도학습 계획 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict
import uuid, datetime

from shared.core.base_database import get_db
from apps.selfstudy.backend.models import StudyPlan

router = APIRouter()

SEED_PLANS = [
    {"title": "수능 수학 1등급 정복 (미적분 심화)", "subject": "수학", "daily_goal_minutes": 90, "days": 30},
    {"title": "토익 850+ 실전 RC/LC 매일 루틴", "subject": "영어", "daily_goal_minutes": 60, "days": 45},
    {"title": "정보처리기사 실기 핵심 요약", "subject": "IT/컴퓨터", "daily_goal_minutes": 60, "days": 21},
]


def _ensure_seed_plans(db: Session, student_id: str):
    count = db.query(StudyPlan).filter(StudyPlan.student_id == student_id).count()
    if count == 0:
        today = datetime.date.today()
        for p in SEED_PLANS:
            plan = StudyPlan(
                id=str(uuid.uuid4()),
                student_id=student_id,
                tenant_id="selfstudy-main",
                title=p["title"],
                subject=p["subject"],
                start_date=today,
                end_date=today + datetime.timedelta(days=p["days"]),
                daily_goal_minutes=p["daily_goal_minutes"],
                weekly_schedule={"mon": True, "tue": True, "wed": True, "thu": True, "fri": True, "sat": True, "sun": False},
                status="active",
            )
            db.add(plan)
        db.commit()


@router.get("/", summary="학습 계획 목록 조회")
async def list_study_plans(
    student_id: str = "demo-student",
    db: Session = Depends(get_db),
):
    _ensure_seed_plans(db, student_id)
    plans = db.query(StudyPlan).filter(StudyPlan.student_id == student_id).all()
    return {
        "student_id": student_id,
        "total": len(plans),
        "plans": [
            {
                "id": p.id,
                "title": p.title,
                "subject": p.subject,
                "start_date": str(p.start_date),
                "end_date": str(p.end_date),
                "daily_goal_minutes": p.daily_goal_minutes,
                "status": p.status,
            }
            for p in plans
        ]
    }


class CreatePlanRequest(BaseModel):
    student_id: Optional[str] = "demo-student"
    title: str
    subject: str
    daily_goal_minutes: Optional[int] = 60
    duration_days: Optional[int] = 30
    tenant_id: Optional[str] = "selfstudy-main"


@router.post("/", summary="새 학습 플랜 생성")
async def create_study_plan(
    body: CreatePlanRequest,
    db: Session = Depends(get_db),
):
    today = datetime.date.today()
    plan = StudyPlan(
        id=str(uuid.uuid4()),
        student_id=body.student_id,
        tenant_id=body.tenant_id,
        title=body.title,
        subject=body.subject,
        start_date=today,
        end_date=today + datetime.timedelta(days=body.duration_days),
        daily_goal_minutes=body.daily_goal_minutes,
        weekly_schedule={"mon": True, "tue": True, "wed": True, "thu": True, "fri": True, "sat": False, "sun": False},
        status="active",
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    return {
        "success": True,
        "message": f"[{plan.title}] 학습 플랜이 생성되었습니다.",
        "plan_id": plan.id,
        "subject": plan.subject,
        "daily_goal_minutes": plan.daily_goal_minutes,
    }


class UpdatePlanStatusRequest(BaseModel):
    status: str  # active | paused | completed


@router.patch("/{plan_id}/status", summary="학습 플랜 상태 변경")
async def update_plan_status(
    plan_id: str,
    body: UpdatePlanStatusRequest,
    db: Session = Depends(get_db),
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="해당 학습 플랜을 찾을 수 없습니다.")
    
    plan.status = body.status
    db.commit()
    return {"success": True, "message": f"학습 플랜 상태가 '{body.status}'(으)로 변경되었습니다.", "plan_id": plan_id, "status": plan.status}


@router.delete("/{plan_id}", summary="학습 플랜 삭제")
async def delete_study_plan(
    plan_id: str,
    db: Session = Depends(get_db),
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="해당 학습 플랜을 찾을 수 없습니다.")
    
    db.delete(plan)
    db.commit()
    return {"success": True, "message": f"학습 플랜 [{plan.title}]이(가) 삭제되었습니다.", "plan_id": plan_id}
