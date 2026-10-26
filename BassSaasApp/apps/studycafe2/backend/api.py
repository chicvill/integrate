"""
backend/api.py — 스터디카페2 FastAPI 라우터.
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from .domain import Branch, Seat, Member, Ticket, StudySession, Payment, ask, bootstrap
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
def status(branch_id: str = "studycafe-main"):
    b = Branch.require(branch_id)
    return {"app_id": "studycafe2", "app_name": "스터디카페 (객체 도메인 모델)", "status": "HEALTHY", **b.stats()}


@router.get("/seats")
def list_seats(branch_id: str = "studycafe-main"):
    b = Branch.require(branch_id)
    return {"success": True, "seats": [s.card() for s in b.seats()]}


@router.post("/seats/{seat_number}/check-in")
def check_in(seat_number: str, payload: Dict[str, Any] = Body(...), branch_id: str = "studycafe-main"):
    b = Branch.require(branch_id)
    seat = next((s for s in b.seats() if s.seat_number == seat_number.upper()), None)
    if not seat:
        raise HTTPException(404, f"{seat_number} 좌석을 찾을 수 없습니다.")
    
    phone = payload.get("phone", "").strip()
    mem = Member.by_phone(phone, branch_id)
    if not mem:
        # 미등록 회원이면 자동 간편 등록
        name = payload.get("name") or f"회원_{phone[-4:]}"
        mem = Member(branch_id=branch_id, phone=phone, name=name).save("quick_reg")
        # 4시간 기본 티켓 자동 지급
        Ticket(branch_id=branch_id, member_id=mem.id, member_name=mem.name, member_phone=mem.phone,
               ticket_type="4시간권", is_time_ticket=True, total_minutes=240, remaining_minutes=240, price=7000).save("issued")

    try:
        sess = seat.check_in(mem)
        return {"success": True, "message": f"{seat.seat_number}에 {mem.name}님 입실 처리되었습니다.", "session_id": sess.id}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/seats/{seat_number}/check-out")
def check_out(seat_number: str, branch_id: str = "studycafe-main"):
    b = Branch.require(branch_id)
    seat = next((s for s in b.seats() if s.seat_number == seat_number.upper()), None)
    if not seat:
        raise HTTPException(404, f"{seat_number} 좌석을 찾을 수 없습니다.")
    try:
        res = seat.check_out()
        return {"success": True, **res}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/seats/{seat_number}/step-out")
def step_out(seat_number: str, branch_id: str = "studycafe-main"):
    b = Branch.require(branch_id)
    seat = next((s for s in b.seats() if s.seat_number == seat_number.upper()), None)
    if not seat:
        raise HTTPException(404, f"{seat_number} 좌석을 찾을 수 없습니다.")
    try:
        if seat.status == "OCCUPIED":
            msg = seat.step_out()
        elif seat.status == "STEP_OUT":
            msg = seat.step_in()
        else:
            raise ValueError(f"{seat_number} 좌석은 비어 있습니다.")
        return {"success": True, "message": msg, "seat_status": seat.status}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/members")
def list_members(branch_id: str = "studycafe-main"):
    ms = Member.find(branch_id)
    return {"success": True, "total": len(ms), "members": [m.model_dump() for m in ms]}


@router.post("/members")
def create_member(payload: Dict[str, Any] = Body(...), branch_id: str = "studycafe-main"):
    phone = payload.get("phone", "").strip()
    if not phone:
        raise HTTPException(400, "전화번호는 필수입니다.")
    mem = Member(
        branch_id=branch_id,
        phone=phone,
        name=payload.get("name", "").strip() or f"회원_{phone[-4:]}",
        pin_code=payload.get("pin_code", "0000"),
        user_type=payload.get("user_type", "GENERAL"),
        is_minor=bool(payload.get("is_minor", False)),
        parent_phone=payload.get("parent_phone", "")
    ).save("registered")
    return {"success": True, "member": mem.model_dump()}


@router.get("/tickets")
def list_tickets(branch_id: str = "studycafe-main"):
    ts = Ticket.find(branch_id)
    return {"success": True, "total": len(ts), "tickets": [t.model_dump() for t in ts]}


@router.post("/tickets")
def issue_ticket_api(payload: Dict[str, Any] = Body(...), branch_id: str = "studycafe-main"):
    phone = payload.get("phone", "").strip()
    name = payload.get("name", "").strip()
    ttype = payload.get("ticket_type", "4주권")
    from .domain.ai_tools import issue_ticket
    res = issue_ticket(phone=phone, name=name, ticket_type=ttype, branch=branch_id)
    return {"success": True, **res}


@router.post("/tickets/{tid}/hold")
def hold_ticket(tid: str, payload: Dict[str, Any] = Body(...)):
    t = Ticket.get(tid)
    if not t:
        raise HTTPException(404, "이용권을 찾을 수 없습니다.")
    days = int(payload.get("days", 7))
    try:
        msg = t.hold(days)
        return {"success": True, "message": msg, "ticket": t.model_dump()}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/tickets/{tid}/resume")
def resume_ticket(tid: str):
    t = Ticket.get(tid)
    if not t:
        raise HTTPException(404, "이용권을 찾을 수 없습니다.")
    try:
        msg = t.resume()
        return {"success": True, "message": msg, "ticket": t.model_dump()}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/ai/chat")
def ai_chat(payload: Dict[str, Any] = Body(...), user: User = Depends(me)):
    msg = (payload.get("message") or "").strip()
    if not msg:
        raise HTTPException(400, "질문 내용을 입력해 주세요.")
    return ask(msg, user, payload.get("branch") or "studycafe-main", payload.get("mode") or "auto")
