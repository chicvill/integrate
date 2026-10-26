"""apps/studycafe/backend/routers/session_router.py - 스터디카페 세션(입퇴실 기록) 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import datetime

from shared.core.base_database import get_db
from apps.studycafe.backend.models import StudyCafeSession, Seat

router = APIRouter()


@router.get("/active", summary="현재 입실 중인 세션 목록")
async def get_active_sessions(
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db),
):
    sessions = db.query(StudyCafeSession).filter(
        StudyCafeSession.tenant_id == tenant_id,
        StudyCafeSession.check_out_at.is_(None),
    ).order_by(StudyCafeSession.check_in_at.desc()).all()

    return {
        "tenant_id": tenant_id,
        "active_count": len(sessions),
        "sessions": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "seat_id": s.seat_id,
                "check_in_at": s.check_in_at.isoformat() if s.check_in_at else None,
            }
            for s in sessions
        ]
    }


@router.get("/history", summary="이용 히스토리 조회")
async def get_session_history(
    user_id: Optional[str] = None,
    tenant_id: str = "studycafe-main",
    limit: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(StudyCafeSession).filter(StudyCafeSession.tenant_id == tenant_id)
    if user_id:
        query = query.filter(StudyCafeSession.user_id == user_id)
    records = query.order_by(StudyCafeSession.check_in_at.desc()).limit(limit).all()

    return {
        "total": len(records),
        "history": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "seat_id": s.seat_id,
                "check_in_at": s.check_in_at.isoformat() if s.check_in_at else None,
                "check_out_at": s.check_out_at.isoformat() if s.check_out_at else None,
                "used_minutes": s.used_minutes,
            }
            for s in records
        ]
    }
