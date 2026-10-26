"""
apps/rent2/backend/routers/branches.py
지점(건물) 목록, 매장 생성/수정/삭제, 솔루션 사용료 수납, 공실 초기화 및 시스템 팩토리 리셋
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException

from ..domain import ALIASES, Building
from ..domain.rent import num, today
from ..kernel.base import store
from ..kernel.identity import User
from .common import get_building, me, serialize_branch

router = APIRouter()
Body_ = Body(default={})


@router.get("/status")
def system_status(user: User = Depends(me)):
    if user.role == "superadmin":
        bs = Building.all()
    else:
        bs = [Building.require(user.branch)] if user.branch else Building.all()[:1]
    stats = [b.stats() for b in bs]
    total, vacant = sum(s["total_rooms"] for s in stats), sum(s["vacant_rooms"] for s in stats)
    return {
        "app_id": "rent2",
        "app_name": "원룸 임차관리 (객체 모델)",
        "status": "HEALTHY",
        "deployment_mode": "LOCAL_STANDALONE",
        "total_rooms": total,
        "active_contracts": total - vacant,
        "vacant_rooms": vacant,
        "branches_count": len(bs),
        "expenses_total": sum(e.amount for b in bs for e in b.expenses()),
        "objects": store().count(),
        "user_role": user.role,
        "user_branch": user.branch
    }


@router.get("/branches")
def list_branches(active_only: bool = False, user: User = Depends(me)):
    if user.role == "superadmin":
        bs = [b for b in Building.all() if b.is_active or not active_only]
    else:
        my_bid = Building.canon(user.branch)
        bs = [b for b in Building.all() if b.id == my_bid and (b.is_active or not active_only)]
    return {
        "success": True,
        "total": len(bs),
        "branches": [serialize_branch(b) for b in bs],
        "user_role": user.role,
        "assigned_branch_id": user.branch
    }


@router.post("/branches", status_code=201)
def create_branch(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자(superadmin)만 건물을 생성할 수 있습니다.")
    bid = (p.get("branch_id") or "").strip()
    if not bid or Building.get(bid):
        raise HTTPException(400, "이미 존재하는 건물/지점 ID이거나 ID가 비어 있습니다.")
    b = Building(
        id=bid,
        name=p.get("name") or bid,
        contact_phone=p.get("contact_phone") or "",
        address=p.get("address") or "",
        fee_plan=p.get("fee_plan") or "원룸 프리미엄 29실형",
        monthly_fee=num(p.get("monthly_fee") or 150000),
        billing_due_day=num(p.get("billing_due_day") or 25),
        aliases=ALIASES.get(bid, [])
    ).save("created")

    init_rooms = p.get("rooms") or p.get("initial_rooms") or p.get("room_count")
    if init_rooms:
        if isinstance(init_rooms, int) or (isinstance(init_rooms, str) and init_rooms.isdigit() and len(init_rooms) <= 3 and int(init_rooms) <= 100):
            cnt = int(init_rooms)
            b.units = [200 + i for i in range(1, cnt + 1)]
        elif isinstance(init_rooms, list):
            b.units = sorted(set(int(x) for x in init_rooms if str(x).isdigit()))
        elif isinstance(init_rooms, str):
            b.units = sorted(set(int(x.strip()) for x in init_rooms.split(",") if x.strip().isdigit()))
        b.save("units_initialized")

    return serialize_branch(b)


@router.get("/branches/{bid}")
def get_branch(bid: str, user: User = Depends(me)):
    return serialize_branch(get_building(bid, user))


@router.patch("/branches/{bid}")
def update_branch(bid: str, p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 건물 기본 설정을 수정할 수 있습니다.")
    return serialize_branch(get_building(bid, user).update(p))


@router.patch("/branches/{bid}/billing")
def update_billing(bid: str, p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 수납 플랜을 수정할 수 있습니다.")
    b = get_building(bid, user)
    st = p.get("billing_status") or b.billing_status
    paid_at = p.get("last_paid_at")
    if st == "PAID" and not paid_at:
        paid_at = today().isoformat()
    updates = {"billing_status": st, "last_paid_at": paid_at}
    if p.get("monthly_fee") is not None:
        updates["monthly_fee"] = num(p["monthly_fee"])
    if p.get("billing_due_day") is not None:
        updates["billing_due_day"] = num(p["billing_due_day"])
    return serialize_branch(b.update(updates))


@router.post("/branches/{bid}/pay-fee")
def pay_branch_fee(bid: str, p: Dict[str, Any] = Body_, user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 매장 사용료를 수납할 수 있습니다.")
    b = get_building(bid, user)
    paid_date = p.get("paid_date") or today().isoformat()
    b.update({"billing_status": "PAID", "last_paid_at": paid_date})
    return {
        "success": True,
        "branch_id": b.id,
        "branch_name": b.name,
        "billing_status": b.billing_status,
        "last_paid_at": b.last_paid_at,
        "monthly_fee": b.monthly_fee,
        "message": f"'{b.name}' 매장의 당월 솔루션 사용료 {b.monthly_fee:,}원이 정상 수납 처리되었습니다."
    }


@router.delete("/branches/{bid}")
def delete_branch(bid: str, user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 건물을 삭제할 수 있습니다.")
    b = get_building(bid, user)
    if b.id == "main":
        raise HTTPException(400, "기본 본사 부동산(시크빌)은 삭제할 수 없습니다.")
    b.destroy()
    return {"success": True, "branch_id": b.id, "message": f"'{b.name}' 부동산과 관련 데이터가 성공적으로 삭제되었습니다."}


@router.post("/branches/{bid}/reset")
def reset_branch(bid: str, p: Dict[str, Any] = Body_, user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 건물을 초기화할 수 있습니다.")
    b = get_building(bid, user)
    b.wipe()
    if (p.get("new_name") or "").strip():
        b.update({"name": p["new_name"].strip()})
    return {
        "success": True,
        "branch_id": b.id,
        "branch_name": b.name,
        "total_rooms": len(b.units),
        "message": f"'{b.name}' 부동산의 모든 수납 장부와 임차인 정보가 초기화(공실화)되었습니다."
    }


@router.post("/system/factory-reset")
def factory_reset(p: Dict[str, Any] = Body_, user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 전체 초기화를 수행할 수 있습니다.")
    name = p.get("building_name", "새로운 임대건물 (29개실)")
    for b in Building.all():
        if b.id == "main":
            b.wipe()
            b.update({"name": name})
        else:
            b.destroy()
    return {"success": True, "message": f"시스템이 성공적으로 초기화되었습니다. ('{name}' 공실 상태)"}
