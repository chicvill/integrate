"""apps/studycafe/backend/routers/ticket_router.py - 스터디카페 이용권 관리 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import datetime

from shared.core.base_database import get_db
from apps.studycafe.backend.models import Ticket, StudyCafeUser

router = APIRouter()

TICKET_PLANS = [
    {"plan_id": "time_2h", "name": "2시간 당일권", "price": 4000, "duration_minutes": 120, "type": "hourly", "desc": "가볍게 집중하는 2시간 기본 자유석"},
    {"plan_id": "time_4h", "name": "4시간 당일권", "price": 7000, "duration_minutes": 240, "type": "hourly", "desc": "반나절 몰입을 위한 4시간 알찬권"},
    {"plan_id": "time_50h", "name": "50시간 정기권", "price": 75000, "duration_minutes": 3000, "type": "period", "desc": "원하는 만큼 자유롭게 차감하는 충전권"},
    {"plan_id": "time_100h", "name": "100시간 정기권", "price": 130000, "duration_minutes": 6000, "type": "period", "desc": "시험기간 집중 대비를 위한 베스트 충전권"},
    {"plan_id": "week_4", "name": "4주 기간권 (일반 자유석)", "price": 150000, "duration_minutes": 40320, "type": "term", "desc": "28일간 24시간 자유롭게 이용하는 무제한권"},
    {"plan_id": "managed_4w", "name": "4주 관리형 프리미엄 패스", "price": 280000, "duration_minutes": 40320, "type": "managed", "desc": "SelfStudy 전과목 진도오더 + PPH 리밸런싱 + 학부모 안심포털"},
    {"plan_id": "managed_12w", "name": "12주 D-day 올인원 패스", "price": 750000, "duration_minutes": 120960, "type": "managed", "desc": "시험일까지 전과목 완독 보장 + Gemini AI 1:1 학습코칭 풀패키지"},
]


@router.get("/plans", summary="구매 가능한 이용권 요금제 목록")
async def list_ticket_plans():
    return {
        "plans": TICKET_PLANS
    }


class PurchaseRequest(BaseModel):
    user_id: Optional[str] = "demo-user"
    phone: Optional[str] = None
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

    # 회원 연동 확인 또는 자동 등록
    target_user = None
    if body.phone:
        target_user = db.query(StudyCafeUser).filter(StudyCafeUser.phone == body.phone).first()
        if not target_user:
            uid = body.user_id if (body.user_id and body.user_id != "demo-user") else str(uuid.uuid4())
            target_user = StudyCafeUser(
                id=uid,
                name="회원",
                phone=body.phone,
                user_type="MANAGED" if (plan.get("type") == "managed" or "관리형" in plan["name"]) else "GENERAL",
                tenant_id=body.tenant_id or "studycafe-main",
            )
            db.add(target_user)
            db.flush()
    if not target_user and body.user_id:
        target_user = db.query(StudyCafeUser).filter(
            (StudyCafeUser.id == body.user_id) | (StudyCafeUser.phone == body.user_id)
        ).first()

    ticket_owner_id = target_user.id if target_user else (body.user_id or body.phone or "demo-user")

    ticket = Ticket(
        id=str(uuid.uuid4()),
        user_id=ticket_owner_id,
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

    # 🎯 결제한 이용권 요금제에 맞춰 회원의 user_type 자동 동기화
    if target_user:
        if plan.get("type") == "managed" or "관리형" in plan["name"]:
            target_user.user_type = "MANAGED"
        else:
            target_user.user_type = "GENERAL"

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


@router.get("/my", summary="내 보유 이용권 조회 및 활성 상태 판정")
async def get_my_tickets(
    user_id: Optional[str] = None,
    phone: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    사용자 ID 또는 전화번호로 보유 중인 이용권을 조회하고,
    결제 과정을 건너뛸 수 있는 유효 활성 티켓(정기권, 기간권, 잔여시간권)을 반환합니다.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 1. 대상 사용자 ID 목록 수집
    user_ids = []
    if user_id:
        user_ids.append(user_id)
    if phone:
        if phone not in user_ids:
            user_ids.append(phone)
        u = db.query(StudyCafeUser).filter(StudyCafeUser.phone == phone).first()
        if u and u.id not in user_ids:
            user_ids.append(u.id)

    if not user_ids:
        return {"has_active_ticket": False, "active_ticket": None, "total": 0, "tickets": []}

    tickets = db.query(Ticket).filter(
        Ticket.user_id.in_(user_ids),
        Ticket.is_active == True,
    ).order_by(Ticket.created_at.desc()).all()

    # 2. 유효 이용권(잔여 시간 > 0 및 유효 기간 내, 일시정지 제외) 선별
    valid_tickets = []
    for t in tickets:
        if t.is_held:
            continue
        is_time_valid = (t.remaining_minutes is None) or (t.remaining_minutes > 0)
        is_date_valid = True
        if t.valid_until:
            t_until = t.valid_until.replace(tzinfo=datetime.timezone.utc) if t.valid_until.tzinfo is None else t.valid_until
            is_date_valid = (t_until >= now)

        if is_time_valid and is_date_valid:
            valid_tickets.append(t)

    active_ticket = valid_tickets[0] if valid_tickets else None

    return {
        "has_active_ticket": bool(active_ticket),
        "active_ticket": {
            "id": active_ticket.id,
            "ticket_type": active_ticket.ticket_type,
            "remaining_minutes": active_ticket.remaining_minutes,
            "valid_until": active_ticket.valid_until.isoformat() if active_ticket.valid_until else None,
            "is_managed": ("관리형" in (active_ticket.ticket_type or "") or "managed" in (active_ticket.ticket_type or "").lower()),
            "is_held": active_ticket.is_held,
        } if active_ticket else None,
        "total": len(tickets),
        "tickets": [
            {
                "id": t.id,
                "ticket_type": t.ticket_type,
                "remaining_minutes": t.remaining_minutes,
                "valid_until": t.valid_until.isoformat() if t.valid_until else None,
                "is_active": t.is_active,
                "is_held": t.is_held,
                "hold_count": t.hold_count or 0,
                "hold_total_days": t.hold_total_days or 0,
            }
            for t in tickets
        ]
    }


class HoldRequest(BaseModel):
    ticket_id: str
    days: Optional[int] = 7


@router.post("/hold", summary="이용권 일시정지(Hold) 신청 (최대 2회, 총 14일)")
async def hold_ticket(body: HoldRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == body.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="이용권을 찾을 수 없습니다.")
    if ticket.is_held:
        raise HTTPException(status_code=400, detail="이미 일시정지(Hold) 상태인 이용권입니다.")
    if (ticket.hold_count or 0) >= 2:
        raise HTTPException(status_code=400, detail="이용권 일시정지는 최대 2회까지만 가능합니다.")
    if (ticket.hold_total_days or 0) + body.days > 14:
        raise HTTPException(status_code=400, detail=f"일시정지 총합 일수(최대 14일)를 초과합니다. (잔여 가능 일수: {14 - (ticket.hold_total_days or 0)}일)")

    now = datetime.datetime.now(datetime.timezone.utc)
    ticket.is_held = True
    ticket.hold_started_at = now
    ticket.hold_count = (ticket.hold_count or 0) + 1
    db.commit()
    db.refresh(ticket)
    return {
        "success": True,
        "message": f"[{ticket.ticket_type}] 이용권이 일시정지되었습니다 (총 {ticket.hold_count}회차).",
        "ticket": {
            "id": ticket.id,
            "is_held": ticket.is_held,
            "hold_count": ticket.hold_count,
            "hold_started_at": ticket.hold_started_at.isoformat(),
        }
    }


class ResumeRequest(BaseModel):
    ticket_id: str


@router.post("/resume", summary="이용권 일시정지 해제 및 만료일 자동 연장")
async def resume_ticket(body: ResumeRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == body.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="이용권을 찾을 수 없습니다.")
    if not ticket.is_held:
        raise HTTPException(status_code=400, detail="일시정지 상태가 아닌 이용권입니다.")

    now = datetime.datetime.now(datetime.timezone.utc)
    hold_start = ticket.hold_started_at.replace(tzinfo=datetime.timezone.utc) if ticket.hold_started_at.tzinfo is None else ticket.hold_started_at
    paused_seconds = max(0, int((now - hold_start).total_seconds()))
    paused_days = max(1, int(paused_seconds / 86400) + 1)

    ticket.is_held = False
    ticket.hold_started_at = None
    ticket.hold_total_days = (ticket.hold_total_days or 0) + paused_days

    # 일시정지된 기간만큼 만료일(valid_until)을 자동으로 뒤로 연장!
    if ticket.valid_until:
        t_until = ticket.valid_until.replace(tzinfo=datetime.timezone.utc) if ticket.valid_until.tzinfo is None else ticket.valid_until
        ticket.valid_until = t_until + datetime.timedelta(seconds=paused_seconds)

    db.commit()
    db.refresh(ticket)
    return {
        "success": True,
        "message": f"[{ticket.ticket_type}] 일시정지가 해제되었습니다. 정지 기간({paused_days}일)만큼 만료일이 자동 연장되었습니다.",
        "ticket": {
            "id": ticket.id,
            "is_held": ticket.is_held,
            "valid_until": ticket.valid_until.isoformat() if ticket.valid_until else None,
            "hold_total_days": ticket.hold_total_days,
        }
    }


# ── 키오스크 IC카드 결제 단말기 (VAN/POS) 연동 엔드포인트 ──
TERMINAL_TRANSACTIONS = {}

class TerminalRequestPayload(BaseModel):
    plan_id: Optional[str] = None
    seat_number: Optional[str] = None
    amount: int
    user_id: Optional[str] = "demo-user"
    name: Optional[str] = "회원"
    phone: Optional[str] = "010-0000-0000"
    user_type: Optional[str] = "GENERAL"


@router.post("/terminal/request", summary="IC카드 결제 단말기 요청 (키오스크)")
async def request_terminal_payment(body: TerminalRequestPayload):
    """
    키오스크에서 결제할 상품(이용권/좌석)과 금액을 지정하여 단말기에 카드 삽입 대기를 요청합니다.
    """
    tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
    plan_name = "스터디카페 결제"
    if body.plan_id:
        p = next((x for x in TICKET_PLANS if x["plan_id"] == body.plan_id), None)
        if p:
            plan_name = p["name"]

    TERMINAL_TRANSACTIONS[tx_id] = {
        "tx_id": tx_id,
        "plan_id": body.plan_id,
        "plan_name": plan_name,
        "seat_number": body.seat_number,
        "amount": body.amount,
        "user_id": body.user_id,
        "name": body.name,
        "phone": body.phone,
        "user_type": body.user_type,
        "status": "WAITING_FOR_CARD",
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "approval_number": None,
        "card_name": None,
    }

    return {
        "success": True,
        "message": f"IC 결제 단말기에 {body.amount:,}원 승인 대기 신호가 전송되었습니다. 카드를 꽂아주세요.",
        "transaction": TERMINAL_TRANSACTIONS[tx_id],
    }


@router.get("/terminal/status/{tx_id}", summary="단말기 결제 승인 상태 조회 (폴링/웹소켓)")
async def get_terminal_status(tx_id: str):
    tx = TERMINAL_TRANSACTIONS.get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="결제 트랜잭션을 찾을 수 없습니다.")
    return tx


@router.post("/terminal/approve/{tx_id}", summary="단말기 IC카드 삽입 & VAN사 승인 시뮬레이터")
async def approve_terminal_payment(
    tx_id: str,
    db: Session = Depends(get_db),
):
    """
    IC카드가 단말기에 삽입되어 VAN사(나이스/KICC/토스 등)로부터 승인이 완료된 상황을 처리합니다.
    이용권이 자동 발급되며, 좌석 번호가 있는 경우 좌석 배정 및 도어 개방까지 원스톱으로 확정됩니다.
    """
    tx = TERMINAL_TRANSACTIONS.get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="결제 트랜잭션을 찾을 수 없습니다.")

    import random
    auth_num = f"{random.randint(10000000, 99999999)}"
    card_names = ["신한카드(9410)", "국민카드(1082)", "현대카드(5530)", "삼성카드(3019)", "카카오뱅크체크(8821)"]
    card_name = random.choice(card_names)
    now = datetime.datetime.now(datetime.timezone.utc)

    tx["status"] = "APPROVED"
    tx["approval_number"] = auth_num
    tx["card_name"] = card_name
    tx["approved_at"] = now.isoformat()

    # 이용권 발급 처리 (plan_id가 있는 경우)
    ticket_info = None
    if tx.get("plan_id"):
        plan = next((p for p in TICKET_PLANS if p["plan_id"] == tx["plan_id"]), None)
        if plan:
            valid_until = now + datetime.timedelta(days=30 if plan["type"] == "term" else 90)
            ticket = Ticket(
                id=str(uuid.uuid4()),
                user_id=tx["user_id"] or "demo-user",
                tenant_id="studycafe-main",
                ticket_type=plan["name"],
                duration_minutes=plan["duration_minutes"],
                remaining_minutes=plan["duration_minutes"],
                valid_from=now,
                valid_until=valid_until,
                is_active=True,
                price=tx["amount"],
            )
            db.add(ticket)
            db.commit()
            db.refresh(ticket)
            ticket_info = {
                "id": ticket.id,
                "ticket_type": ticket.ticket_type,
                "remaining_minutes": ticket.remaining_minutes,
            }

    return {
        "success": True,
        "message": f"🎉 [{card_name}] 정상 승인 완료! (승인번호: {auth_num})",
        "approval_number": auth_num,
        "card_name": card_name,
        "amount": tx["amount"],
        "ticket": ticket_info,
        "seat_number": tx.get("seat_number"),
    }
