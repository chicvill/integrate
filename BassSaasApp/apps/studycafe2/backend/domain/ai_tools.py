"""
domain/ai_tools.py — 스터디카페 객체를 AI 도구로 노출 (@tool).
"""
import re
from typing import Any, Dict, List, Tuple
from ..kernel import agent
from ..kernel.agent import tool
from ..kernel.base import recall
from .studycafe import Branch, Seat, Member, Ticket, StudySession, Payment, now_str, today_str


# ───────────── 읽기 도구 ─────────────
@tool()
def seat_map_summary(branch: str = "studycafe-main") -> Dict[str, Any]:
    """좌석 및 지점 이용 현황 요약: 총 좌석, 이용 중, 외출, 잔여석, 이용률."""
    b = Branch.require(branch)
    s = b.stats()
    return {
        **s,
        "message": f"🏢 {s['branch_name']}: 총 {s['total_seats']}석 중 {s['occupied_count']}석 이용 중 (외출 {s['step_out_count']}석) · 잔여 {s['empty_count']}석 (가동률 {s['occupancy_rate']}%)"
    }


@tool()
def search_member(query: str, branch: str = "studycafe-main") -> Dict[str, Any]:
    """회원 검색: 이름 또는 전화번호 뒷자리로 회원 및 이용권 정보를 찾는다."""
    hits = [m for m in Member.find(branch) if query in m.name or query in m.phone]
    if not hits:
        return {"count": 0, "members": [], "message": f"'{query}' 회원을 찾지 못했습니다."}
    
    lines = []
    data = []
    for m in hits:
        tks = m.active_tickets()
        t_desc = ", ".join(f"{t.ticket_type}(잔여: {t.remaining_minutes}분/만기:{t.valid_until})" for t in tks) or "유효 이용권 없음"
        lines.append(f"· {m.name} ({m.phone}) - {m.user_type} / {t_desc}")
        data.append({"id": m.id, "name": m.name, "phone": m.phone, "tickets": t_desc})
    return {"count": len(hits), "members": data, "message": f"'{query}' 회원 검색 결과:\n" + "\n".join(lines)}


@tool()
def minor_curfew_check(branch: str = "studycafe-main") -> Dict[str, Any]:
    """심야 청소년 이용 점검: 22:00 이후 심야 이용 제한 대상 청소년 점유 좌석 확인 및 퇴실 권고."""
    b = Branch.require(branch)
    violators = []
    for s in b.seats():
        if s.status in ("OCCUPIED", "STEP_OUT") and s.current_member_phone:
            m = Member.by_phone(s.current_member_phone, branch)
            if m and m.is_minor and not m.night_exempt:
                violators.append({"seat": s.seat_number, "name": m.name, "phone": m.phone})
    
    if not violators:
        return {"violators": [], "message": "✅ 현재 심야 이용 제한(미성년자 22시) 규정 위반 좌석이 없습니다."}
    
    lines = [f"· {v['seat']}석 {v['name']} ({v['phone']})" for v in violators]
    return {
        "violators": violators,
        "message": f"⚠️ 심야 청소년 셧다운 대상 {len(violators)}명 감지!\n" + "\n".join(lines) + "\n즉시 퇴실 조치가 필요합니다."
    }


# ───────────── 쓰기 도구 ─────────────
@tool(write=True)
def check_out_seat(seat_number: str, branch: str = "studycafe-main") -> Dict[str, Any]:
    """퇴실 처리: 해당 좌석을 퇴실 처리하고 이용 시간을 정산한다 (예: A-05)."""
    seat_num = seat_number.upper().strip()
    if not seat_num.startswith("A-"):
        seat_num = f"A-{seat_num.zfill(2)}" if seat_num.isdigit() else seat_num
    
    seat = next((s for s in Seat.find(branch) if s.seat_number == seat_num), None)
    if not seat:
        raise LookupError(f"{seat_num} 좌석을 찾을 수 없습니다.")
    
    res = seat.check_out()
    return res


@tool(write=True)
def check_in_seat(seat_number: str, phone: str, branch: str = "studycafe-main") -> Dict[str, Any]:
    """입실 처리: 회원 전화번호로 해당 좌석에 입실 배정한다."""
    seat_num = seat_number.upper().strip()
    if not seat_num.startswith("A-"):
        seat_num = f"A-{seat_num.zfill(2)}" if seat_num.isdigit() else seat_num
    
    seat = next((s for s in Seat.find(branch) if s.seat_number == seat_num), None)
    if not seat:
        raise LookupError(f"{seat_num} 좌석을 찾을 수 없습니다.")
    
    mem = Member.by_phone(phone, branch)
    if not mem:
        raise LookupError(f"'{phone}' 번호의 회원이 등록되어 있지 않습니다. 먼저 회원을 등록해 주세요.")
    
    sess = seat.check_in(mem)
    return {"session": sess.id, "message": f"🎟️ {seat.seat_number} 좌석에 {mem.name}님 입실 처리 완료되었습니다."}


@tool(write=True)
def toggle_step_out(seat_number: str, branch: str = "studycafe-main") -> Dict[str, Any]:
    """외출/복귀 전환: 이용 중이면 외출(STEP_OUT) 처리, 외출 중이면 복귀 처리한다."""
    seat_num = seat_number.upper().strip()
    if not seat_num.startswith("A-"):
        seat_num = f"A-{seat_num.zfill(2)}" if seat_num.isdigit() else seat_num
    
    seat = next((s for s in Seat.find(branch) if s.seat_number == seat_num), None)
    if not seat:
        raise LookupError(f"{seat_num} 좌석을 찾을 수 없습니다.")
    
    if seat.status == "OCCUPIED":
        msg = seat.step_out()
    elif seat.status == "STEP_OUT":
        msg = seat.step_in()
    else:
        raise ValueError(f"{seat_num} 좌석은 비어 있어 외출/복귀 처리를 할 수 없습니다.")
    return {"message": msg}


@tool(write=True)
def issue_ticket(phone: str, name: str, ticket_type: str = "4주권", branch: str = "studycafe-main") -> Dict[str, Any]:
    """이용권 발급/충전: 회원에게 신규 이용권을 발급한다."""
    mem = Member.by_phone(phone, branch)
    if not mem:
        mem = Member(branch_id=branch, phone=phone, name=name).save("registered")
    elif name and mem.name != name:
        mem.name = name
        mem.save("updated")
    
    is_time = "시간" in ticket_type
    minutes = 0
    valid_days = 28
    price = 150000
    
    if "2시간" in ticket_type: minutes, valid_days, price = 120, 1, 4000
    elif "4시간" in ticket_type: minutes, valid_days, price = 240, 1, 7000
    elif "10시간" in ticket_type: minutes, valid_days, price = 600, 7, 15000
    elif "50시간" in ticket_type: minutes, valid_days, price = 3000, 90, 70000
    elif "100시간" in ticket_type: minutes, valid_days, price = 6000, 180, 130000
    elif "2주" in ticket_type: valid_days, price = 14, 80000
    elif "4주 관리형" in ticket_type: valid_days, price = 28, 250000
    elif "12주" in ticket_type: valid_days, price = 84, 380000

    from datetime import date, timedelta
    v_from = date.today().isoformat()
    v_until = (date.today() + timedelta(days=valid_days)).isoformat()

    tk = Ticket(
        branch_id=branch,
        member_id=mem.id,
        member_name=mem.name,
        member_phone=mem.phone,
        ticket_type=ticket_type,
        is_time_ticket=is_time,
        total_minutes=minutes,
        remaining_minutes=minutes,
        valid_from=v_from,
        valid_until=v_until,
        price=price
    ).save("issued")

    Payment(
        branch_id=branch,
        member_name=mem.name,
        member_phone=mem.phone,
        ticket_type=ticket_type,
        amount=price,
        note="이용권 결제"
    ).save("paid")

    return {
        "ticket_id": tk.id,
        "message": f"💳 {mem.name}님께 '{ticket_type}' 발급 완료 (금액: {price:,}원, 유효기간: ~{v_until})"
    }


# ───────────── 오프라인 빠른 규칙 ─────────────
def _args(msg: str, ctx: dict, **extra: Any) -> dict:
    a = dict(ctx)
    if (m := re.search(r"A?-?\s*(\d{1,2})", msg, re.I)):
        a["seat_number"] = f"A-{m.group(1).zfill(2)}"
    if (m := re.search(r"(01[016789]-?\d{3,4}-?\d{4})", msg)):
        a["phone"] = m.group(1)
    return {**a, **extra}


def _out_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    return [("check_out_seat", _args(m.string, ctx))]


def _step_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    return [("toggle_step_out", _args(m.string, ctx))]


def _summary_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    return [("seat_map_summary", _args(m.string, ctx))]


def _curfew_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    return [("minor_curfew_check", _args(m.string, ctx))]


agent.OFFLINE_RULES[:] = [(re.compile(p, re.I), fn) for p, fn in [
    (r"퇴실|체크아웃|비워|반납", _out_rule),
    (r"외출|복귀|자리비움", _step_rule),
    (r"현황|요약|좌석|브리핑|공석|빈자리", _summary_rule),
    (r"심야|청소년|미성년|22시|셧다운", _curfew_rule),
]]


def system_prompt(user: Any) -> str:
    return (
        f"당신은 스마트 스터디카페 관제 AI 비서입니다. 좌석, 회원, 이용권 객체를 제어합니다.\n"
        f"사용자: {user.summary()}. 친절하고 간결하게 응답하고, 좌석 퇴실/입실 요청 시 정확한 도구를 실행하세요."
    )
