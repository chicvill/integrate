"""apps/studycafe/backend/routers/ticket_router.py - 스터디카페 이용권 관리 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import datetime

from shared.core.base_database import get_db
from apps.studycafe.backend.models import Ticket

router = APIRouter()

TICKET_PLANS = [
    {"plan_id": "time_2h", "name": "2시간 당일권", "price": 4000, "duration_minutes": 120, "type": "hourly"},
    {"plan_id": "time_4h", "name": "4시간 당일권", "price": 7000, "duration_minutes": 240, "type": "hourly"},
    {"plan_id": "time_50h", "name": "50시간 정기권", "price": 75000, "duration_minutes": 3000, "type": "period"},
    {"plan_id": "time_100h", "name": "100시간 정기권", "price": 130000, "duration_minutes": 6000, "type": "period"},
    {"plan_id": "week_4", "name": "4주 기간권 (자유석)", "price": 150000, "duration_minutes": 40320, "type": "term"},
]


@router.get("/plans", summary="구매 가능한 이용권 요금제 목록")
async def list_ticket_plans():
    return {
        "plans": TICKET_PLANS
    }


class PurchaseRequest(BaseModel):
    user_id: Optional[str] = "demo-user"
    plan_id: str
    tenant_id: Optional[str] = "studycafe-main"


@router.post("/purchase", summary="이용권 구매/발급")
async def purchase_ticket(
    body: PurchaseRequest,
    db: Session = Depends(get_db),
):
    plan = next((p for p in TICKET_PLANS if p["plan_id"] == body.plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="유효하지 않은 요금제 ID입니다.")

    now = datetime.datetime.now(datetime.timezone.utc)
    valid_until = now + datetime.timedelta(days=30 if plan["type"] == "term" else 90)

    ticket = Ticket(
        id=str(uuid.uuid4()),
        user_id=body.user_id,
        tenant_id=body.tenant_id,
        ticket_type=plan["name"],
        duration_minutes=plan["duration_minutes"],
        remaining_minutes=plan["duration_minutes"],
        valid_from=now,
        valid_until=valid_until,
        is_active=True,
        price=plan["price"],
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return {
        "success": True,
        "message": f"[{plan['name']}] 이용권이 발급되었습니다.",
        "ticket": {
            "id": ticket.id,
            "ticket_type": ticket.ticket_type,
            "remaining_minutes": ticket.remaining_minutes,
            "valid_until": ticket.valid_until.isoformat() if ticket.valid_until else None,
            "is_active": ticket.is_active,
        }
    }


@router.get("/my", summary="내 보유 이용권 조회")
async def get_my_tickets(
    user_id: str = "demo-user",
    db: Session = Depends(get_db),
):
    tickets = db.query(Ticket).filter(
        Ticket.user_id == user_id,
        Ticket.is_active == True,
    ).all()
    return {
        "user_id": user_id,
        "total": len(tickets),
        "tickets": [
            {
                "id": t.id,
                "ticket_type": t.ticket_type,
                "remaining_minutes": t.remaining_minutes,
                "valid_until": t.valid_until.isoformat() if t.valid_until else None,
                "is_active": t.is_active,
            }
            for t in tickets
        ]
    }
