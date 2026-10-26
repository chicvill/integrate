"""
apps/rent2/backend/routers/rooms.py
호실 조회, 계약 등록/수정, 납부 수납(FIFO) 및 취소(LIFO), 일괄 수납, 매트릭스 임포트
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException

from ..domain import ai_tools
from ..domain.rent import num, today
from ..kernel.identity import User
from .common import get_building, get_unit, me

router = APIRouter()
Body_ = Body(default={})


@router.get("/rooms")
def get_rooms(branch_id: str = "main", year: Optional[int] = None, user: User = Depends(me)):
    b = get_building(branch_id, user)
    rooms = b.rooms(year)
    return {
        "success": True,
        "branch_id": b.id,
        "total_rooms": len(rooms),
        "selected_room": min(rooms, default=101),
        "rooms": rooms
    }


@router.get("/rooms/{n}")
def get_room(n: int, branch_id: str = "main", user: User = Depends(me)):
    return get_unit(branch_id, n, user).room()


@router.post("/rooms/{n}/contract")
@router.put("/rooms/{n}/contract")
@router.put("/rooms/{n}")
def update_room(n: int, form: Dict[str, Any] = Body(...), branch_id: str = "main", user: User = Depends(me)):
    u = get_unit(branch_id, n, user)
    u.update(form)
    return {"success": True, "room": u.room(), "message": f"{n}호 계약 정보가 저장되었습니다."}


@router.post("/rooms/batch-import")
def batch_import(rows: List[Dict[str, Any]] = Body(...), branch_id: str = "main", clear_existing: bool = True, user: User = Depends(me)):
    return get_building(branch_id, user).import_rooms(rows, clear_existing)


@router.post("/rooms/reset")
def reset_rooms(branch_id: str = "main", user: User = Depends(me)):
    b = get_building(branch_id, user)
    b.wipe()
    b.units = []
    b.save("rooms_reset")
    return {"success": True, "branch_id": b.id, "message": "모든 호실 데이터가 초기화되었습니다."}


@router.post("/rooms/ocr-import")
def ocr_import(p: Dict[str, Any] = Body(...), branch_id: str = "main", user: User = Depends(me)):
    if not p.get("image_base64"):
        raise HTTPException(400, "이미지 데이터가 전달되지 않았습니다.")
    return ai_tools.read_contract_image(p["image_base64"])


@router.post("/rooms/fill-payments")
def fill_payments(p: Dict[str, Any] = Body_, branch_id: str = "main", user: User = Depends(me)):
    """현재 세입자 기준으로 장부를 규칙값으로 재계산 (수동 기록을 지우고 계산식으로 되돌림)"""
    b, only = get_building(branch_id, user), (num(p.get("room_number")) or None)
    done = [u.number for u in b.view() if u.active() and (only is None or u.number == only) and (u.reset_ledger() or True)]
    return {"success": True, "updated_rooms": done, "count": len(done), "message": f"{len(done)}개 호실의 전입일 기준 납부내역이 동기화되었습니다."}


@router.post("/rooms/{n}/payment")
def pay(n: int, p: Dict[str, Any] = Body(...), branch_id: str = "main", user: User = Depends(me)):
    u = get_unit(branch_id, n, user)
    force = bool(p.get("force_month"))
    req_m = num(p.get("month")) or today().month
    req_y = num(p.get("year")) or today().year

    # 중복 입금 방지: force가 아닌 경우, 미납이 없고 대상월이 이미 완납이면 차단
    if not force:
        unpaids = u.unpaid_periods()
        if len(unpaids) == 0 and u.period(req_y, req_m).get("paid"):
            c_act = u.active()
            tname = (c_act.tenant_name if c_act else "") or f"{n}호"
            raise HTTPException(400, f"⚠️ [중복 입금 오류] {n}호 {tname}님은 {req_y}년 {req_m:02d}월까지 이미 전액 완납 상태입니다. 중복 수납 처리를 할 수 없습니다.")

    # 임차료와 관리비 분리 처리
    amt = num(p.get("amount") or p.get("rent_amount"))
    rent_amt = p.get("rent_amount")
    maint_amt = p.get("maintenance_amount")

    if (maint_amt is None or maint_amt == 0) and amt and amt > 0:
        s_rent, s_maint, _, _ = u.split_payment_amount(amt, req_y, req_m)
        rent_amt, maint_amt = s_rent, s_maint

    if force and p.get("month"):
        p_obj = u.pay(num(p.get("month")), p.get("year"), p.get("paid_date"), p.get("note") or "정상 입금",
                      p.get("tenant_name"), rent_amt, maint_amt, check_duplicate=not force)
        app_y, app_m, was_oldest = p_obj.year, p_obj.month, False
    else:
        # 비즈니스 규칙: 미납월 중 가장 오래된 월부터 우선 적용 (FIFO)
        try:
            p_obj, app_y, app_m, was_oldest = u.pay_fifo(
                paid_date=p.get("paid_date"),
                note=p.get("note") or "정상 입금",
                tenant_name=p.get("tenant_name"),
                rent_amount=rent_amt,
                maintenance_amount=maint_amt,
                fallback_month=num(p.get("month")),
                fallback_year=num(p.get("year")),
                check_duplicate=True
            )
        except ValueError as ve:
            raise HTTPException(400, str(ve))
    res = u.room()
    res["applied_period"] = f"{app_y}-{app_m:02d}"
    res["was_oldest_unpaid"] = was_oldest
    return res


@router.post("/rooms/{n}/cancel-payment")
def cancel(n: int, p: Dict[str, Any] = Body(...), branch_id: str = "main", user: User = Depends(me)):
    u = get_unit(branch_id, n, user)
    force = bool(p.get("force_month"))
    if force and p.get("month"):
        p_obj = u.cancel(num(p.get("month")), p.get("year"), p.get("note"))
        c_y, c_m = p_obj.year, p_obj.month
    else:
        # 비즈니스 규칙: 완납월 중 가장 최근월에 우선 적용 (LIFO)
        p_obj, c_y, c_m = u.cancel_lifo(
            note=p.get("note") or "납부 취소",
            fallback_month=num(p.get("month")),
            fallback_year=num(p.get("year"))
        )
    res = u.room()
    res["cancelled_period"] = f"{c_y}-{c_m:02d}"
    return res


@router.post("/payments/batch-collect")
@router.post("/branches/{bid}/payments/batch-collect")
def batch_collect(p: Dict[str, Any] = Body(...), bid: Optional[str] = None, user: User = Depends(me)):
    target_bid = bid or p.get("branch_id")
    return get_building(target_bid, user).collect(
        p.get("year"),
        num(p.get("start_month") or 1),
        num(p.get("end_month") or 10),
        p.get("payment_date_mode") or "contract",
        p.get("specific_date"),
        p.get("note") or "정상 입금 (일괄 수납)",
        bool(p.get("include_unoccupied"))
    )


@router.post("/payments/matrix-import")
@router.post("/branches/{bid}/payments/matrix-import")
def matrix_import(p: Dict[str, Any] = Body(...), bid: Optional[str] = None, user: User = Depends(me)):
    rows = p.get("rooms") or p.get("matrix_rooms") or []
    if not isinstance(rows, list):
        raise HTTPException(400, "rooms 배열 데이터가 필요합니다.")
    target_bid = bid or p.get("branch_id")
    return get_building(target_bid, user).import_matrix(rows)
