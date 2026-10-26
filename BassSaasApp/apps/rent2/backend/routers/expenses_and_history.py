"""
apps/rent2/backend/routers/expenses_and_history.py
지출 장부 CRUD, 전출 세입자 이력 보관 및 영구 정리, 만기 도래 호실 목록
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException

from ..domain.rent import Contract, Expense, num, today
from ..kernel.identity import User
from .common import get_building, me, serialize_expense

router = APIRouter()


# ── 이력 / 만기 ──
@router.get("/tenant-histories")
def tenant_histories(branch_id: str = "main", room_number: Optional[int] = None, user: User = Depends(me)):
    hs = [h.history_row() for h in get_building(branch_id, user).histories(room_number)]
    return {"success": True, "total": len(hs), "histories": hs}


@router.delete("/tenant-histories/expired")
def purge_expired(branch_id: str = "main", user: User = Depends(me)):
    b = get_building(branch_id, user)
    before = sum(1 for c in Contract.find(b.id) if not c.active)
    after = len(b.histories())
    return {
        "success": True,
        "branch_id": b.id,
        "purged_count": before - after,
        "message": f"전출 후 1년이 경과한 세입자 이력 {before - after}건이 영구 정리되었습니다."
    }


@router.delete("/tenant-histories/{hid}")
def delete_history(hid: str, branch_id: str = "main", user: User = Depends(me)):
    b = get_building(branch_id, user)
    c = Contract.get(hid) or (next(iter(b.unit(int(hid)).ended()), None) if hid.isdigit() else None)
    if not c or c.building_id != b.id or c.active:
        raise HTTPException(404, "삭제할 전출 이력을 찾을 수 없습니다.")
    c.delete("history_deleted")
    return {"success": True, "message": f"[{c.unit}호] {c.tenant_name}님의 전출 이력이 성공적으로 삭제되었습니다."}


@router.get("/expiring-rooms")
def expiring(branch_id: str = "main", days_window: int = 65, user: User = Depends(me)):
    b = get_building(branch_id, user)
    rows = b.expiring(days_window)
    return {"success": True, "branch_id": b.id, "total": len(rows), "rooms": rows}


# ── 지출 장부 ──
@router.get("/expenses")
def list_expenses(branch_id: str = "main", user: User = Depends(me)):
    es = get_building(branch_id, user).expenses()
    return {
        "success": True,
        "total": len(es),
        "total_amount": sum(e.amount for e in es),
        "expenses": [serialize_expense(e) for e in es]
    }


@router.post("/expenses", status_code=201)
def create_expense(p: Dict[str, Any] = Body(...), branch_id: str = "main", user: User = Depends(me)):
    b = get_building(branch_id, user)
    return serialize_expense(
        Expense(
            building_id=b.id,
            date=p.get("date") or today().isoformat(),
            item=p.get("item") or "지출",
            amount=num(p.get("amount")),
            note=p.get("note") or "",
            receipt_type=p.get("receipt_type") or "",
            receipt_info=p.get("receipt_info") or ""
        ).save()
    )


@router.delete("/expenses/{eid}")
def delete_expense(eid: str, branch_id: str = "main", user: User = Depends(me)):
    b = get_building(branch_id, user)
    e = Expense.get(eid)
    if not e or e.building_id != b.id:
        raise HTTPException(404, "해당 지출 내역을 찾을 수 없습니다.")
    e.delete()
    return {"success": True, "message": "지출 내역이 삭제되었습니다."}
