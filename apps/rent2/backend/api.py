"""
api.py — 기존 rent 프런트엔드와 100% 호환되는 REST 레이어 + 객체/AI 신규 엔드포인트.
라우터는 HTTP ↔ 객체 호출 변환만 한다. 규칙은 전부 도메인 객체 안에 있다.
"""
import os
import re
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Response

from .domain import ALIASES, Building, agent, ask, parser
from .domain import ai_tools, vat
from .domain.rent import Contract, Expense, Payment, Room, Unit, num, today
from .kernel.base import recall, store
from .kernel.identity import UpgradeRequest, User

router = APIRouter()
Body_ = Body(default={})


def _resolve_bid(ref: Optional[str], user: User) -> str:
    """
    사용자 권한에 맞는 정규화된 지점 ID 반환.
    - superadmin: 모든 건물 자유롭게 조회 가능 (기본값 main)
    - branch_admin: 무조건 본인 소속 지점만 허용! 타 지점 요청 시 403 차단!
    """
    if user.role != "superadmin":
        my_bid = Building.canon(user.branch or "main")
        if ref and Building.canon(ref) != my_bid:
            raise HTTPException(403, f"접근 거부: 본인 소속 건물 외 타 건물({ref})의 정보에는 접근할 수 없습니다.")
        return my_bid
    return Building.canon(ref or "main")


def _b(ref: Optional[str], user: Optional[User] = None) -> Building:
    bid = _resolve_bid(ref, user) if user else Building.canon(ref)
    try:
        return Building.require(bid)
    except Exception:
        all_b = Building.cached_all()
        return all_b[0] if all_b else Building.require(bid)


def _unit(branch_id: Optional[str], n: int, user: Optional[User] = None) -> Unit:
    return _b(branch_id, user).unit(n)


def me(authorization: str = Header(""), token: Optional[str] = Query(None)) -> User:
    raw = authorization or (f"Bearer {token}" if token else "")
    u = User.from_token(raw)
    if not u:
        raise HTTPException(401, "로그인이 필요합니다. (인증 토큰 누락 또는 유효하지 않음)")
    return u


# ── 상태 / 건물 ──
@router.get("/status")
def system_status(user: User = Depends(me)):
    if user.role == "superadmin":
        bs = Building.all()
    else:
        bs = [Building.require(user.branch)] if user.branch else Building.all()[:1]
    stats = [b.stats() for b in bs]
    total, vacant = sum(s["total_rooms"] for s in stats), sum(s["vacant_rooms"] for s in stats)
    return {"app_id": "rent2", "app_name": "원룸 임차관리 (객체 모델)", "status": "HEALTHY", "deployment_mode": "LOCAL_STANDALONE",
            "total_rooms": total, "active_contracts": total - vacant, "vacant_rooms": vacant, "branches_count": len(bs),
            "expenses_total": sum(e.amount for b in bs for e in b.expenses()), "objects": store().count(),
            "user_role": user.role, "user_branch": user.branch}


@router.get("/branches")
def list_branches(active_only: bool = False, user: User = Depends(me)):
    """
    건물 목록 조회:
    - superadmin: 본사 총괄이므로 모든 건물 목록 반환
    - branch_admin: 본인 소속 건물 1개만 반환 (타 건물 열람 원천 차단)
    """
    if user.role == "superadmin":
        bs = [b for b in Building.all() if b.is_active or not active_only]
    else:
        my_bid = Building.canon(user.branch)
        bs = [b for b in Building.all() if b.id == my_bid and (b.is_active or not active_only)]
    return {"success": True, "total": len(bs), "branches": [_branch(b) for b in bs],
            "user_role": user.role, "assigned_branch_id": user.branch}


def _branch(b: Building) -> Dict[str, Any]:
    d = b.model_dump()
    res = {**{k: d[k] for k in ("id", "name", "contact_phone", "address", "fee_plan", "monthly_fee", "billing_status",
                                 "billing_due_day", "last_paid_at", "is_active")}, "branch_id": b.id}
    res["total_rooms"] = len(b.units)
    res["rooms_count"] = len(b.units)
    return res


@router.post("/branches", status_code=201)
def create_branch(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자(superadmin)만 건물을 생성할 수 있습니다.")
    bid = (p.get("branch_id") or "").strip()
    if not bid or Building.get(bid):
        raise HTTPException(400, "이미 존재하는 건물/지점 ID이거나 ID가 비어 있습니다.")
    b_name = (p.get("name") or bid).strip()
    b_aliases = list(set([bid, b_name]))
    b = Building(id=bid, name=b_name, contact_phone=p.get("contact_phone") or "", address=p.get("address") or "",
                 fee_plan=p.get("fee_plan") or "원룸 프리미엄 29실형", monthly_fee=num(p.get("monthly_fee") or 150000),
                 billing_due_day=num(p.get("billing_due_day") or 25), aliases=b_aliases).save("created")
    
    # 초기 호실 자동 생성 (호실 수 또는 호실 번호 목록)
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

    Building.invalidate_cache()
    return _branch(b)


@router.get("/branches/{bid}")
def get_branch(bid: str, user: User = Depends(me)):
    return _branch(_b(bid, user))


@router.patch("/branches/{bid}")
def update_branch(bid: str, p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 건물 기본 설정을 수정할 수 있습니다.")
    return _branch(_b(bid, user).update(p))


@router.patch("/branches/{bid}/billing")
def update_billing(bid: str, p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 수납 플랜을 수정할 수 있습니다.")
    b = _b(bid, user)
    st = p.get("billing_status") or b.billing_status
    paid_at = p.get("last_paid_at")
    if st == "PAID" and not paid_at:
        paid_at = today().isoformat()
    updates = {"billing_status": st, "last_paid_at": paid_at}
    if p.get("monthly_fee") is not None:
        updates["monthly_fee"] = num(p["monthly_fee"])
    if p.get("billing_due_day") is not None:
        updates["billing_due_day"] = num(p["billing_due_day"])
    return _branch(b.update(updates))


@router.post("/branches/{bid}/pay-fee")
def pay_branch_fee(bid: str, p: Dict[str, Any] = Body_, user: User = Depends(me)):
    """본사 최고관리자가 해당 매장의 당월 사용료를 수납(완납) 처리합니다."""
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 매장 사용료를 수납할 수 있습니다.")
    b = _b(bid, user)
    paid_date = p.get("paid_date") or today().isoformat()
    note = p.get("note") or "정기 사용료 수납 완료"
    b.update({"billing_status": "PAID", "last_paid_at": paid_date})
    return {"success": True, "branch_id": b.id, "branch_name": b.name,
            "billing_status": b.billing_status, "last_paid_at": b.last_paid_at,
            "monthly_fee": b.monthly_fee, "message": f"'{b.name}' 매장의 당월 솔루션 사용료 {b.monthly_fee:,}원이 정상 수납 처리되었습니다."}


@router.delete("/branches/{bid}")
def delete_branch(bid: str, user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 건물을 삭제할 수 있습니다.")
    # 정확한 ID로 매장 검색 (alias 오인으로 인한 타 매장 오삭제 원천 방지)
    b = Building.get(bid) or Building.resolve(bid)
    if not b:
        raise HTTPException(404, f"해당 매장({bid})을 찾을 수 없습니다.")
    if b.id == "main":
        raise HTTPException(400, "기본 본사 부동산(시크빌)은 삭제할 수 없습니다.")
    target_name, target_id = b.name, b.id
    b.destroy()
    Building.invalidate_cache()
    return {"success": True, "branch_id": target_id, "message": f"'{target_name}' 부동산과 관련 데이터가 성공적으로 삭제되었습니다."}


@router.post("/branches/{bid}/reset")
def reset_branch(bid: str, p: Dict[str, Any] = Body_, user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 건물을 초기화할 수 있습니다.")
    b = _b(bid, user)
    b.wipe()
    if (p.get("new_name") or "").strip():
        b.update({"name": p["new_name"].strip()})
    return {"success": True, "branch_id": b.id, "branch_name": b.name, "total_rooms": len(b.units),
            "message": f"'{b.name}' 부동산의 모든 수납 장부와 임차인 정보가 초기화(공실화)되었습니다."}


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


# ── 호실 / 계약 ──
@router.get("/rooms")
def get_rooms(branch_id: str = "main", year: Optional[int] = None, user: User = Depends(me)):
    b = _b(branch_id, user)
    rooms = b.rooms(year)
    return {"success": True, "branch_id": b.id, "total_rooms": len(rooms), "selected_room": min(rooms, default=101), "rooms": rooms}


@router.get("/rooms/{n}")
def get_room(n: int, branch_id: str = "main", user: User = Depends(me)):
    return _unit(branch_id, n, user).room()


@router.post("/rooms/{n}/contract")
@router.put("/rooms/{n}/contract")
@router.put("/rooms/{n}")
def update_room(n: int, form: Dict[str, Any] = Body(...), branch_id: str = "main", user: User = Depends(me)):
    u = _unit(branch_id, n, user)
    u.update(form)
    return {"success": True, "room": u.room(), "message": f"{n}호 계약 정보가 저장되었습니다."}


@router.post("/rooms/batch-import")
def batch_import(rows: List[Dict[str, Any]] = Body(...), branch_id: str = "main", clear_existing: bool = True, user: User = Depends(me)):
    return _b(branch_id, user).import_rooms(rows, clear_existing)


@router.post("/rooms/reset")
def reset_rooms(branch_id: str = "main", user: User = Depends(me)):
    b = _b(branch_id, user)
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
    b, only = _b(branch_id, user), (num(p.get("room_number")) or None)
    done = [u.number for u in b.view() if u.active() and (only is None or u.number == only) and (u.reset_ledger() or True)]
    return {"success": True, "updated_rooms": done, "count": len(done), "message": f"{len(done)}개 호실의 전입일 기준 납부내역이 동기화되었습니다."}


@router.post("/sync/google-sheet")
def sync_google_sheet(p: Dict[str, Any] = Body_, branch_id: str = "main", user: User = Depends(me)):
    """구글 스프레드시트 2025/2026년 장부 데이터를 실시간 동기화하여 계약 및 납부내역에 반영"""
    from .domain import sheet_sync
    url = (p.get("sheet_url") or "").strip() or sheet_sync.DEFAULT_SHEET_URL
    bid = _resolve_bid(branch_id, user)
    try:
        res = sheet_sync.sync_sheet_data(url, bid)
        return res
    except Exception as e:
        raise HTTPException(500, f"구글 스프레드시트 동기화 실패: {str(e)}")


@router.post("/rooms/{n}/payment")
def pay(n: int, p: Dict[str, Any] = Body(...), branch_id: str = "main", user: User = Depends(me)):
    u = _unit(branch_id, n, user)
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
    u = _unit(branch_id, n, user)
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
    return _b(target_bid, user).collect(p.get("year"), num(p.get("start_month") or 1), num(p.get("end_month") or 10),
                                        p.get("payment_date_mode") or "contract", p.get("specific_date"),
                                        p.get("note") or "정상 입금 (일괄 수납)", bool(p.get("include_unoccupied")))


@router.post("/payments/matrix-import")
@router.post("/branches/{bid}/payments/matrix-import")
def matrix_import(p: Dict[str, Any] = Body(...), bid: Optional[str] = None, user: User = Depends(me)):
    rows = p.get("rooms") or p.get("matrix_rooms") or []
    if not isinstance(rows, list):
        raise HTTPException(400, "rooms 배열 데이터가 필요합니다.")
    target_bid = bid or p.get("branch_id")
    return _b(target_bid, user).import_matrix(rows)


# ── 이력 / 만기 / 지출 ──
@router.get("/tenant-histories")
def tenant_histories(branch_id: str = "main", room_number: Optional[int] = None, user: User = Depends(me)):
    hs = [h.history_row() for h in _b(branch_id, user).histories(room_number)]
    return {"success": True, "total": len(hs), "histories": hs}


@router.delete("/tenant-histories/expired")
def purge_expired(branch_id: str = "main", user: User = Depends(me)):
    b = _b(branch_id, user)
    before = sum(1 for c in Contract.find(b.id) if not c.active)
    after = len(b.histories())
    return {"success": True, "branch_id": b.id, "purged_count": before - after,
            "message": f"전출 후 1년이 경과한 세입자 이력 {before - after}건이 영구 정리되었습니다."}


@router.delete("/tenant-histories/{hid}")
def delete_history(hid: str, branch_id: str = "main", user: User = Depends(me)):
    b = _b(branch_id, user)
    c = Contract.get(hid) or (next(iter(b.unit(int(hid)).ended()), None) if hid.isdigit() else None)
    if not c or c.building_id != b.id or c.active:
        raise HTTPException(404, "삭제할 전출 이력을 찾을 수 없습니다.")
    c.delete("history_deleted")
    return {"success": True, "message": f"[{c.unit}호] {c.tenant_name}님의 전출 이력이 성공적으로 삭제되었습니다."}


@router.get("/expiring-rooms")
def expiring(branch_id: str = "main", days_window: int = 65, user: User = Depends(me)):
    b = _b(branch_id, user)
    rows = b.expiring(days_window)
    return {"success": True, "branch_id": b.id, "total": len(rows), "rooms": rows}


def _exp(e: Expense) -> Dict[str, Any]:
    return {**e.model_dump(), "branch_id": e.building_id}


@router.get("/expenses")
def list_expenses(branch_id: str = "main", user: User = Depends(me)):
    es = _b(branch_id, user).expenses()
    return {"success": True, "total": len(es), "total_amount": sum(e.amount for e in es), "expenses": [_exp(e) for e in es]}


@router.post("/expenses", status_code=201)
def create_expense(p: Dict[str, Any] = Body(...), branch_id: str = "main", user: User = Depends(me)):
    b = _b(branch_id, user)
    return _exp(Expense(building_id=b.id, date=p.get("date") or today().isoformat(), item=p.get("item") or "지출",
                        amount=num(p.get("amount")), note=p.get("note") or "", receipt_type=p.get("receipt_type") or "",
                        receipt_info=p.get("receipt_info") or "").save())


@router.delete("/expenses/{eid}")
def delete_expense(eid: str, branch_id: str = "main", user: User = Depends(me)):
    b = _b(branch_id, user)
    e = Expense.get(eid)
    if not e or e.building_id != b.id:
        raise HTTPException(404, "해당 지출 내역을 찾을 수 없습니다.")
    e.delete()
    return {"success": True, "message": "지출 내역이 삭제되었습니다."}


# ── 부가세 / 백업 ──
def _rooms_csv(s: Optional[str]) -> Optional[List[int]]:
    return [int(r) for r in (s or "").split(",") if r.strip().isdigit()] or None


def _attach(content: bytes, media: str, filename: str) -> Response:
    q = urllib.parse.quote(filename)
    return Response(content, media_type=media, headers={"Content-Disposition": f"attachment; filename=\"{q}\"; filename*=UTF-8''{q}",
                                                         "Access-Control-Expose-Headers": "Content-Disposition"})


@router.get("/vat-report")
def vat_report(branch_id: str = "main", start_month: int = Query(1, ge=1, le=12), end_month: int = Query(6, ge=1, le=12),
               year: Optional[int] = None, room_numbers: Optional[str] = None, user: User = Depends(me)):
    if start_month > end_month:
        raise HTTPException(400, "시작월은 종료월보다 클 수 없습니다.")
    return vat.report(_b(branch_id, user), start_month, end_month, year, _rooms_csv(room_numbers))


@router.get("/vat-report/download")
def vat_download(branch_id: str = "main", start_month: int = Query(1, ge=1, le=12), end_month: int = Query(6, ge=1, le=12),
                 year: Optional[int] = None, format_type: str = Query("excel", pattern="^(excel|csv)$"), room_numbers: Optional[str] = None, user: User = Depends(me)):
    if start_month > end_month:
        raise HTTPException(400, "시작월은 종료월보다 클 수 없습니다.")
    d = vat.report(_b(branch_id, user), start_month, end_month, year, _rooms_csv(room_numbers))
    stem, csv = f"부동산_부가세_수납현황_{d['year']}년_{start_month}월_{end_month}월", format_type == "csv"
    return _attach(vat.csv_bytes(d) if csv else vat.excel_bytes(d), "text/csv; charset=utf-8" if csv else "application/vnd.ms-excel; charset=utf-8",
                   stem + (".csv" if csv else ".xls"))


@router.get("/vat-settings")
def get_vat_settings(branch_id: str = "main", user: User = Depends(me)):
    b = _b(branch_id, user)
    return {"success": True, "branch_id": b.id, "vat_target_rooms": b.vat_target_rooms}


@router.post("/vat-settings")
def save_vat_settings(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    b = _b(p.get("branch_id"), user)
    b.vat_target_rooms = sorted(set(num(r) for r in p.get("vat_target_rooms") or []))
    b.save("vat_settings")
    return {"success": True, "branch_id": b.id, "vat_target_rooms": b.vat_target_rooms,
            "message": f"부가세 대상 호실 {len(b.vat_target_rooms)}개실 설정이 영구 저장되었습니다."}


@router.get("/backup/download")
def backup_download(branch_id: str = "main", user: User = Depends(me)):
    import json
    b = _b(branch_id, user)
    return _attach(json.dumps(b.backup(), ensure_ascii=False, indent=2).encode(), "application/json; charset=utf-8",
                   f"{b.name}_전체백업_{datetime.now():%Y%m%d_%H%M%S}.json")


@router.post("/backup/restore")
def backup_restore(payload: Dict[str, Any], target_branch_id: str = "main", user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 전체 백업 데이터를 복원할 수 있습니다.")
    return _b(target_branch_id, user).restore(payload.get("data", payload))


# ── 인증 / 계정 ──
def _user_row(u: User) -> Dict[str, Any]:
    b = Building.resolve(u.branch) if u.branch else None
    return {**u.public(), "assigned_branch_id": u.branch, "assigned_branch_name": (b.name if b else u.branch) if u.branch else "전체 권한(본사)",
            "created_at": u.created}


@router.post("/auth/register")
def register(p: Dict[str, Any] = Body(...)):
    u = User.create(p.get("username", ""), p.get("password", ""), name=(p.get("name") or "").strip(), phone=(p.get("phone") or "").strip(),
                    branch=p.get("assigned_branch_id") or p.get("target_branch_id"), reason=(p.get("reason") or "").strip())
    return {"success": True, "message": "회원가입 신청이 완료되었습니다. 본사 관리자(admin) 승인 후 로그인하실 수 있습니다.",
            "user_id": u.id, "username": u.username, "status": u.status}


@router.post("/auth/login")
@router.post("/auth/admin-login")
def login(p: Dict[str, Any] = Body(...)):
    try:
        u = User.login(p.get("username", ""), p.get("password", ""))
    except ValueError as e:
        raise HTTPException(401, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))
    b = Building.resolve(u.branch) if u.branch else None
    user_info = {
        "user_id": u.id,
        "username": u.username,
        "name": u.name,
        "role": u.role,
        "branch": u.branch,
        "branch_name": b.name if b else ("본사 총괄" if u.role == "superadmin" else (u.branch or ""))
    }
    return {
        "success": True,
        "user_id": u.id,
        "username": u.username,
        "name": u.name,
        "role": u.role,
        "assigned_branch_id": u.branch,
        "access_token": u.token(),
        "user": user_info
    }


@router.get("/auth/me")
def auth_me(user: User = Depends(me)):
    b = Building.resolve(user.branch) if user.branch else None
    user_info = {
        "user_id": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "branch": user.branch,
        "branch_name": b.name if b else ("본사 총괄" if user.role == "superadmin" else (user.branch or ""))
    }
    return {
        "success": True,
        "user_id": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "assigned_branch_id": user.branch,
        "assigned_branch_name": user_info["branch_name"],
        "user": user_info
    }


@router.get("/auth/users")
def users():
    rows = [_user_row(u) for u in sorted(User.all(), key=lambda u: u.created, reverse=True)]
    return {"success": True, "total": len(rows), "users": rows}


def _user(uid: str) -> User:
    u = User.get(uid)
    if not u:
        raise HTTPException(400, f"계정을 찾을 수 없습니다: {uid}")
    return u


@router.patch("/auth/users/{uid}/status")
def approve_user(uid: str, p: Dict[str, Any] = Body(...)):
    u = _user(uid)
    if p.get("action") == "APPROVE":
        u.status, u.branch, u.role = "APPROVED", p.get("assigned_branch_id") or u.branch, p.get("role") or u.role
    elif p.get("action") == "REJECT":
        u.status = "REJECTED"
    u.reason = p.get("reason") or u.reason
    u.save(u.status.lower())
    return {"success": True, "message": f"계정이 {u.status} 처리되었습니다.", "user_id": u.id, "status": u.status, "assigned_branch_id": u.branch}


@router.patch("/auth/users/{uid}")
def update_user(uid: str, p: Dict[str, Any] = Body(...)):
    u = _user(uid)
    for k, attr in (("name", "name"), ("status", "status"), ("role", "role")):
        if p.get(k):
            setattr(u, attr, p[k].strip())
    if p.get("phone") is not None:
        u.phone = p["phone"].strip()
    if p.get("assigned_branch_id") is not None:
        u.branch = p["assigned_branch_id"].strip() or None
    if p.get("password"):
        u.set_password(p["password"])
    u.save("updated")
    return {"success": True, "message": "사용자 정보가 성공적으로 수정되었습니다.", "user_id": u.id}


@router.delete("/auth/users/{uid}")
def delete_user(uid: str):
    u = _user(uid)
    if u.username == "admin":
        raise HTTPException(400, "본사 최고관리자(admin) 계정은 삭제할 수 없습니다.")
    u.delete()
    return {"success": True, "message": f"계정({u.username})이 삭제되었습니다."}


@router.post("/upgrade-request")
def upgrade_request(p: Dict[str, Any] = Body(...)):
    r = UpgradeRequest(user_name=p.get("user_name", ""), contact=p.get("contact", ""), target_branch=p.get("target_branch_id", ""),
                       reason=p.get("reason") or "").save("requested")
    return {"success": True, "message": "등업 신청이 접수되었습니다. 본사 승인 대기 중입니다.", "request_id": r.id}


@router.get("/upgrade-requests")
def upgrade_requests():
    return {"success": True, "requests": [r.model_dump() | {"target_branch_id": r.target_branch, "assigned_branch_id": r.assigned_branch} for r in UpgradeRequest.all()]}


@router.post("/upgrade-requests/approve")
def upgrade_approve(p: Dict[str, Any] = Body(...)):
    r = UpgradeRequest.get(p.get("request_id", ""))
    if not r:
        raise HTTPException(404, "등업 신청 내역을 찾을 수 없습니다.")
    r.status = "APPROVED" if p.get("action") == "APPROVE" else "REJECTED"
    r.assigned_branch = (p.get("assigned_branch_id") or r.target_branch) if r.status == "APPROVED" else r.assigned_branch
    r.save(r.status.lower())
    return {"success": True, "status": r.status}


@router.get("/auth/upgrade/requests")
def upgrade_list():
    rows = [{"id": u["id"], "username": u["username"], "name": u["name"], "user_name": f"{u['name']} ({u['username']})", "contact": u["phone"],
             "target_branch_id": u["assigned_branch_id"] or "미지정", "reason": u["reason"] or "", "created_at": u["created_at"],
             "status": u["status"], "assigned_branch_id": u["assigned_branch_name"]} for u in map(_user_row, User.all()) if u["username"] != "admin"]
    return {"success": True, "requests": rows}


@router.post("/auth/upgrade/requests/{rid}/approve")
def upgrade_req_approve(rid: str, p: Dict[str, Any] = Body_):
    return approve_user(rid, {"action": "APPROVE", "assigned_branch_id": p.get("assigned_branch_id")})


@router.post("/auth/upgrade/requests/{rid}/reject")
def upgrade_req_reject(rid: str):
    return approve_user(rid, {"action": "REJECT"})


@router.post("/admin/sync-remote")
def sync_remote():
    s = system_status()
    return {"success": True, "message": f"데이터베이스 점검 완료 (건물 {s['branches_count']}개 · 호실 {s['total_rooms']}개 · 객체 {s['objects']}개)",
            "stats": {"branches": s["branches_count"], "rooms": s["total_rooms"], "objects": s["objects"]}}


# ── 신규: 객체 기억 / 타임라인 / AI ──
@router.get("/objects/search")
def objects_search(q: str, kind: str = "", building: str = "", limit: int = 10, user: User = Depends(me)):
    scope = Building.canon(user.branch or building) if (user.branch or building) else None
    if scope and not user.can("read", scope):
        raise HTTPException(403, "조회 권한이 없습니다.")
    return {"query": q, "items": [{k: h[k] for k in ("kind", "id", "scope", "summary")} for h in recall(q, [kind] if kind else None, scope, limit)]}


@router.get("/objects/timeline")
def objects_timeline(building: str = "", limit: int = 30, user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "타임라인 감사 로그는 본사 최고관리자만 조회할 수 있습니다.")
    scope = Building.canon(user.branch or building) if (user.branch or building) else None
    return {"events": store().timeline(scope, limit=limit)}


@router.get("/ai/tools")
def ai_tools_list():
    return {"tools": [{"name": t.name, "description": t.doc, "write": t.write, "params": list(t.params)} for t in agent.TOOLS.values()],
            "engine": "gemini" if agent.api_key() else "offline"}


@router.post("/ai/chat")
def ai_chat(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    msg = (p.get("message") or "").strip()
    if not msg:
        raise HTTPException(400, "메시지를 입력해 주세요.")
    return ask(msg, user, p.get("building") or "", p.get("mode") or "auto")


@router.post("/ai/execute")
def ai_execute(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    try:
        out = agent.confirm(p.get("pending_id", ""), user)
    except LookupError as e:
        raise HTTPException(404, str(e))
    return {"success": True, "result": out, "message": agent.say(out)}


# ── 스마트 인제스트 (카메라 / 클립보드 붙여넣기 / 구글시트 / 파일경로 자동화) ──
@router.post("/smart/detect-input")
def detect_input_type(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    """클립보드 입력 내용(문자, 구글시트 URL, 로컬 파일경로, 이미지)의 유형을 지능형 판별"""
    text = (p.get("text") or "").strip()
    img = (p.get("image_base64") or "").strip()
    bid = Building.canon(user.branch or p.get("branch_id") or "main")

    # 1. 이미지 데이터 (클립보드 사진 붙여넣기 등)
    if img or text.startswith("data:image/"):
        return {
            "kind": "image",
            "title": "📷 사진 / 이미지 감지됨",
            "description": "클립보드 또는 파일로 붙여넣은 사진 데이터입니다.",
            "action_label": "⚡ 사진 AI 분석 및 자동 등록",
            "default_scan_kind": "receipt"
        }

    # 2. 구글 스프레드시트 URL
    if "docs.google.com/spreadsheets" in text:
        return {
            "kind": "google_sheet",
            "title": "📊 구글 스프레드시트 링크 감지됨",
            "description": "시크빌 2025/2026년 장부 스프레드시트입니다.",
            "action_label": "🔄 2025/2026 장부 실시간 동기화",
            "url": text
        }

    # 3. 로컬 파일 경로 감지
    clean_path = re.sub(r"^file:///?", "", text.strip('"\'; \t\r\n'))
    looks_like_file = bool(re.search(r"\.(xlsx|xls|csv|tsv|png|jpg|jpeg|webp|pdf)$", clean_path, re.I) or re.match(r"^[a-zA-Z]:[\\/]", clean_path))
    if looks_like_file:
        if os.path.exists(clean_path):
            ext = os.path.splitext(clean_path)[1].lower()
            if ext in (".xlsx", ".xls", ".csv", ".tsv"):
                return {
                    "kind": "file_excel",
                    "title": f"📁 장부 파일 감지됨 ({os.path.basename(clean_path)})",
                    "description": f"로컬 파일 경로: {clean_path}",
                    "action_label": "📋 장부 파일 동기화",
                    "file_path": clean_path
                }
            elif ext in (".jpg", ".jpeg", ".png", ".webp", ".pdf"):
                return {
                    "kind": "file_image",
                    "title": f"🖼️ 사진 파일 감지됨 ({os.path.basename(clean_path)})",
                    "description": f"로컬 사진 경로: {clean_path}",
                    "action_label": "🔍 사진 파일 AI OCR 분석",
                    "file_path": clean_path,
                    "default_scan_kind": "receipt"
                }
        else:
            return {
                "kind": "file_not_found",
                "title": "⚠️ 파일 경로 확인 필요",
                "description": f"파일을 찾을 수 없습니다: {clean_path}",
                "action_label": "파일 경로 다시 확인",
                "file_path": clean_path
            }

    # 4. 은행 입금 문자 / 카카오톡 알림
    single = parser.parse_bank_message(text, bid)
    has_bank_keywords = any(kw in text for kw in ("입금", "이체", "호", "원", "보냈습니다", "타행", "당행"))
    if single.get("room_number") or has_bank_keywords:
        room_desc = f"{single['room_number']}호" if single.get("room_number") else "호실 자동확인"
        amt_desc = f"{single['amount']:,}원" if single.get("amount") else "계약금액 자동적용"
        return {
            "kind": "bank_text",
            "title": "💬 은행 입금 알림 문자 / 카톡 감지됨",
            "description": f"인식: {room_desc} | 금액: {amt_desc} | 입금일: {single.get('paid_date', '')}",
            "action_label": "💳 입금 수납 처리 확정",
            "parsed": single
        }

    # 5. 일반 텍스트
    return {
        "kind": "text",
        "title": "📝 텍스트 입력",
        "description": "입력된 내용을 분석하여 적절한 처리 방식을 안내합니다.",
        "action_label": "입금 수납 또는 처리 시도"
    }


@router.post("/smart/universal-ingest")
def universal_ingest(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    """만능 스마트 붙여넣기 통합 처리:
    - 은행 입금 문자 ➡️ FIFO 수납 처리
    - 구글 스프레드시트 URL ➡️ 2025/2026 연도별 장부 동기화
    - 로컬 엑셀/CSV 파일 ➡️ 장부 데이터 동기화
    - 사진(클립보드 이미지/로컬 사진) ➡️ 영수증/계약서 AI OCR 스캔 및 등록
    """
    text = (p.get("text") or "").strip()
    img = (p.get("image_base64") or "").strip()
    bid = Building.canon(p.get("branch_id") or user.branch or "main")
    scan_kind = p.get("scan_kind") or "receipt"

    clear_before_import = bool(p.get("clear_before_import", True))

    # A. 이미지 데이터 (base64 직접 전달 또는 text가 data:image)
    if img or text.startswith("data:image/"):
        target_img = img or text

        # 1) 입금 알림 지정 요청인 경우
        if scan_kind == "bank_sms":
            sms_res = ai_tools.read_bank_sms_image(target_img)
            res: Dict[str, Any] = {"success": False, "applied_count": 0, "message": "분석 실패"}
            if sms_res.get("success") and sms_res.get("text"):
                # 계약 대장 표를 올렸는데 입금 알림으로 선택한 경우: 계약 대장 패턴 우선 감지
                roster_cands = parser.parse_contract_roster(sms_res["text"])
                if len(roster_cands) >= 2 or (roster_cands and any(r.get("deposit") or r.get("rent") for r in roster_cands)):
                    con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True, "clear_before_import": clear_before_import}, user)
                    if con_res.get("success") and int(con_res.get("applied_count") or 0) > 0:
                        return con_res

                # 은행 입금 수납 처리 시도
                res = smart_paste_payment({"text": sms_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = sms_res["text"]
                if res.get("success") and int(res.get("applied_count") or 0) > 0:
                    return res

            # 수납 처리가 안 된 경우(계약 대장 사진이거나 지출 영수증인 경우) 자동 스마트 폴백!
            con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True, "clear_before_import": clear_before_import}, user)
            if con_res.get("success") and int(con_res.get("applied_count") or 0) > 0:
                return con_res
            rec_res = smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if rec_res.get("success") and (rec_res.get("expense") or (rec_res.get("data") and rec_res["data"].get("amount"))):
                return rec_res
            
            if sms_res.get("success") and sms_res.get("text"):
                return res
            raise HTTPException(400, sms_res.get("message") or "입금 알림 사진에서 글자를 인식하지 못했습니다.")

        # 2) 계약 대장 지정 요청인 경우
        elif scan_kind == "contract":
            con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True, "clear_before_import": clear_before_import}, user)
            # 입금 알림 사진으로 자동 감지된 경우 즉시 수납 처리로 연계
            if con_res.get("kind") == "bank_sms" and con_res.get("text"):
                res = smart_paste_payment({"text": con_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = con_res["text"]
                return res
            if con_res.get("success") and int(con_res.get("applied_count") or 0) > 0:
                return con_res
            rec_res = smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            return rec_res if (rec_res.get("success") and rec_res.get("expense")) else con_res

        # 3) 지출 영수증 지정 요청인 경우
        elif scan_kind == "receipt":
            rec_res = smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if rec_res.get("success") and (rec_res.get("expense") or (rec_res.get("data") and rec_res["data"].get("amount"))):
                return rec_res
            con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True, "clear_before_import": clear_before_import}, user)
            if con_res.get("kind") == "bank_sms" and con_res.get("text"):
                res = smart_paste_payment({"text": con_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = con_res["text"]
                return res
            if con_res.get("success") and int(con_res.get("applied_count") or 0) > 0:
                return con_res
            return rec_res

        # 4) AI 스마트 자동 판별 (scan_kind == "auto" 또는 기타)
        else:
            con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True, "clear_before_import": clear_before_import}, user)
            if con_res.get("kind") == "bank_sms" and con_res.get("text"):
                res = smart_paste_payment({"text": con_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = con_res["text"]
                return res
            if con_res.get("success") and int(con_res.get("applied_count") or 0) > 0:
                return con_res
            
            rec_res = smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if rec_res.get("success") and (rec_res.get("expense") or (rec_res.get("data") and rec_res["data"].get("amount"))):
                return rec_res
            
            sms_res = ai_tools.read_bank_sms_image(target_img)
            if sms_res.get("success") and sms_res.get("text"):
                res = smart_paste_payment({"text": sms_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = sms_res["text"]
                if res.get("success") and int(res.get("applied_count") or 0) > 0:
                    return res
            
            return con_res if con_res.get("success") else rec_res

    # B. 구글 시트 URL
    if "docs.google.com/spreadsheets" in text:
        from .domain import sheet_sync
        res = sheet_sync.sync_sheet_data(text, bid)
        return {
            "success": True,
            "kind": "google_sheet",
            "message": f"구글 스프레드시트 2025/2026년 장부 동기화가 완료되었습니다!\n- 동기화 호실: {res['total_rooms']}개실\n- 총 납부내역 반영: {res['total_payments_synced']}건",
            "data": res
        }

    # C. 로컬 파일 경로
    clean_path = re.sub(r"^file:///?", "", text.strip('"\'; \t\r\n'))
    looks_like_file = bool(re.search(r"\.(xlsx|xls|csv|tsv|png|jpg|jpeg|webp|pdf)$", clean_path, re.I) or re.match(r"^[a-zA-Z]:[\\/]", clean_path))
    if looks_like_file:
        if not os.path.exists(clean_path):
            raise HTTPException(400, f"지정된 로컬 파일을 찾을 수 없습니다: {clean_path}")
        ext = os.path.splitext(clean_path)[1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".pdf"):
            import base64
            with open(clean_path, "rb") as f:
                b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("utf-8")
            if scan_kind == "contract":
                return smart_ocr_contract({"image_base64": b64, "branch_id": bid, "auto_apply": True, "clear_before_import": clear_before_import}, user)
            else:
                return smart_ocr_receipt({"image_base64": b64, "branch_id": bid, "auto_apply": True}, user)
        elif ext in (".xlsx", ".xls", ".csv", ".tsv"):
            from .domain import sheet_sync
            res = sheet_sync.sync_file_data(clean_path, bid)
            return {
                "success": True,
                "kind": "file_excel",
                "message": f"로컬 장부 파일({os.path.basename(clean_path)}) 2025/2026년 동기화가 완료되었습니다!\n- 동기화 호실: {res['total_rooms']}개실\n- 총 납부내역 반영: {res['total_payments_synced']}건",
                "data": res
            }

    # D. 임대차 계약 대장 / 세입자 명부 텍스트 (보증금, 월세, 전입일 등 포함)
    roster_items = parser.parse_contract_roster(text)
    if roster_items and any(item.get("tenant_name") or item.get("deposit") or item.get("rent") for item in roster_items):
        b = _b(bid, user)
        # 만약 기존 건물이 신규 개설 직후이거나 전체 공실인 경우, 붙여넣은 실제 호실 번호 목록으로 깔끔하게 교체
        has_active_contracts = any((act := u.active()) is not None and bool(act.tenant_name) for u in b.view())
        new_roster_units = sorted(set(item["room_number"] for item in roster_items))
        if not has_active_contracts:
            b.units = new_roster_units
            b.save("units_realigned_from_roster")

        if clear_before_import:
            Payment.purge(b.id)
            Contract.purge(b.id)
            Room.purge(b.id)
            store().db.execute("DELETE FROM objects WHERE kind='room' AND json_extract(data, '$.building_id') = ?", (b.id,))

        applied = []
        for item in roster_items:
            rn = item["room_number"]
            # 건물의 units에 호실이 없으면 자동 등록 (호실 번호 확장)
            if rn not in b.units:
                b.add_unit(rn)
            u = b.unit(rn)
            form_dict = {
                "name": item["tenant_name"],
                "tenant_name": item["tenant_name"],
                "phone": item.get("phone", ""),
                "move_in": item.get("move_in", ""),
                "deposit": item.get("deposit", 0),
                "rent": item.get("rent", 0),
                "maintenance": item.get("maintenance", 0),
                "pay_timing": item.get("pay_timing", "후불"),
                "clean_fee": item.get("clean_fee", 80000),
                "memo": item.get("memo", {})
            }
            u.update(form_dict)
            applied.append(rn)
        
        b.sync_all_rooms()
        Building.invalidate_cache()
        return {
            "success": True,
            "kind": "contract_roster",
            "applied_count": len(applied),
            "message": f"총 {len(applied)}개 호실의 임대차 계약 정보가 성공적으로 일괄 등록되었습니다!",
            "rooms": applied
        }

    # E. 은행 입금 문자 / 카카오톡 알림
    res = smart_paste_payment({"text": text, "branch_id": bid, "auto_apply": True}, user)
    res["kind"] = "bank_payment"
    return res


@router.post("/smart/paste-payment")
def smart_paste_payment(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    """은행 입금 알림 문자/카톡 텍스트 붙여넣기 ➡️ 호실·금액·일자 자동 파싱 및 수납 처리"""
    text = (p.get("text") or "").strip()
    bid = Building.canon(user.branch or p.get("branch_id") or "main")
    if not text:
        raise HTTPException(400, "분석할 문자 또는 카톡 텍스트를 입력해 주세요.")
    
    parsed_list = parser.parse_batch_bank_messages(text, bid)
    if not parsed_list:
        single = parser.parse_bank_message(text, bid)
        parsed_list = [single] if (single.get("room_number") or single.get("detected_tenant")) else []
        
    if not parsed_list:
        return {"success": False, "message": "입금 문자에서 호실 번호(예: 403호) 또는 입금자명(세입자)을 찾지 못했습니다.", "items": []}

    auto_apply = bool(p.get("auto_apply", True))
    applied = []
    b = _b(bid)

    for item in parsed_list:
        room = item.get("room_number", 0)
        # 1. 파싱된 호실이 유효하지 않은 경우, 송금자명(세입자)으로 해당 매장의 호실 재검색
        if room not in b.units and item.get("detected_tenant"):
            tname = item["detected_tenant"].strip()
            for u_num in b.units:
                u_cand = b.unit(u_num)
                c_act = u_cand.active()
                if c_act and c_act.tenant_name and c_act.tenant_name.strip() == tname:
                    room = u_num
                    item["room_number"] = u_num
                    break
                # 과거 이력도 확인
                for h in u_cand.ended():
                    if h.tenant_name and h.tenant_name.strip() == tname:
                        room = u_num
                        item["room_number"] = u_num
                        break
                if room in b.units:
                    break

        if room in b.units and auto_apply:
            u = b.unit(room)
            amt = item["amount"]
            # 금액이 0이면 호실의 활성 계약 기준 월세+관리비로 자동 충당
            if amt <= 0:
                c = u.active()
                amt = (c.monthly_rent + c.maintenance) if c else 0

            target_y = item.get("target_year") or today().year
            target_m = item.get("target_month") or today().month
            unpaids = u.unpaid_periods()

            # 1. 2026.10 완납 상태가 되었는데 중복 입금되면 오류 메시지로 안내
            is_target_paid = u.period(target_y, target_m).get("paid", False)
            if len(unpaids) == 0 and is_target_paid:
                c_act = u.active()
                tname = item.get("detected_tenant") or (c_act.tenant_name if c_act else "") or f"{room}호"
                item["applied"] = False
                item["is_duplicate"] = True
                item["error_reason"] = f"⚠️ [중복 입금 오류] {room}호 {tname}님은 {target_y}년 {target_m:02d}월까지 이미 전액 완납되었습니다. 중복 입금(송금액: {amt:,}원)이 감지되어 자동 수납이 차단되었습니다."
                continue

            # 2. 계약내용의 임차료와 관리비를 참조하여 분리 저장
            split_rent, split_maint, is_mismatch, c_total = u.split_payment_amount(amt, target_y, target_m)
            item["split_rent"] = split_rent
            item["split_maintenance"] = split_maint
            item["amount_mismatch"] = is_mismatch
            item["contract_expected"] = c_total
            item["diff"] = amt - c_total

            if amt > 0:
                mismatch_tag = f" [⚠️계약불일치: 계약 {c_total:,}원 ≠ 송금 {amt:,}원]" if is_mismatch else ""
                note_suffix = " (계약금액 자동적용)" if item.get("is_fallback_amount") or item["amount"] == 0 else ""
                try:
                    pay_obj, app_y, app_m, was_oldest = u.pay_fifo(
                        paid_date=item["paid_date"],
                        note=f"문자 자동수납 ({item['detected_tenant'] or '입금자'} {amt:,}원{mismatch_tag}{note_suffix})",
                        tenant_name=item.get("detected_tenant"),
                        rent_amount=split_rent,
                        maintenance_amount=split_maint,
                        fallback_month=target_m,
                        fallback_year=target_y,
                        check_duplicate=True
                    )
                    item["applied"] = True
                    item["applied_amount"] = amt
                    item["applied_rent"] = split_rent
                    item["applied_maintenance"] = split_maint
                    item["applied_year"] = app_y
                    item["applied_month"] = app_m
                    item["was_oldest_unpaid"] = was_oldest
                    item["payment_id"] = pay_obj.id
                    applied.append(item)
                except ValueError as ve:
                    item["applied"] = False
                    item["is_duplicate"] = True
                    item["error_reason"] = str(ve)
            else:
                item["applied"] = False
                item["error_reason"] = f"{room}호의 입금 금액을 확인하지 못했습니다."
        else:
            item["applied"] = False
            if room == 0:
                item["error_reason"] = f"입금 알림에서 호실 번호(예: 101호) 또는 등록된 세입자({item.get('detected_tenant') or '이름'})를 식별하지 못했습니다."
            else:
                item["error_reason"] = f"매장({b.name})에 등록되지 않은 호실({room}호)이거나 계약된 세입자를 찾을 수 없습니다."

    ok = len(applied) > 0
    fail_reasons = [it.get("error_reason") for it in parsed_list if it.get("error_reason")]
    fail_msg = " | ".join(fail_reasons) if fail_reasons else "호실 계약 정보 또는 입금 금액을 확인하지 못했습니다."

    mismatch_items = [it for it in applied if it.get("amount_mismatch")]
    mismatch_notice = ""
    if mismatch_items:
        first_m = mismatch_items[0]
        mismatch_notice = f" <span style='color:#dc2626;font-weight:800;'>[⚠️ 계약금액 불일치: 계약 {first_m['contract_expected']:,}원 ≠ 송금 {first_m['applied_amount']:,}원 (차액: {first_m['diff']:+,}원)]</span>"

    success_msg = f"총 {len(parsed_list)}건 중 {len(applied)}건이 자동 수납 처리되었습니다."
    if mismatch_notice:
        success_msg += mismatch_notice

    return {
        "success": ok,
        "branch_id": bid,
        "total_parsed": len(parsed_list),
        "applied_count": len(applied),
        "items": parsed_list,
        "message": success_msg if ok else fail_msg
    }


def _normalize_contract_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """임대차 대장/계약서 OCR 결과의 다양한 한글/영문 필드명을 안전하게 정규화"""
    room_raw = (row.get("호실") or row.get("호수") or row.get("방번호") or row.get("room_number") or 
                row.get("room") or row.get("unit") or row.get("호") or "")
    room_n = num(room_raw)

    name = str(row.get("세입자") or row.get("성명") or row.get("이름") or row.get("임차인") or 
               row.get("입주자") or row.get("입주인") or row.get("name") or row.get("tenant") or "").strip()
    
    phone = str(row.get("연락처") or row.get("전화번호") or row.get("휴대폰") or row.get("핸드폰") or 
                row.get("phone") or row.get("tel") or "").strip()

    id_number = str(row.get("주민등록번호") or row.get("주민번호") or row.get("id_number") or "").strip()
    deposit = num(row.get("보증금") or row.get("전세금") or row.get("deposit"))
    if 0 < deposit < 10000:   # 500 -> 5,000,000원 (만원 단위 표기 보정)
        deposit = deposit * 10000
    rent = num(row.get("월세") or row.get("차임") or row.get("임대료") or row.get("월차임") or row.get("rent"))
    if 0 < rent < 10000:      # 35 -> 350,000원 (만원 단위 표기 보정)
        rent = rent * 10000
    maintenance = num(row.get("관리비") or row.get("maintenance"))
    if 0 < maintenance < 1000:
        maintenance = maintenance * 10000
    clean_fee = num(row.get("청소비") or row.get("clean_fee"))

    move_in = str(row.get("전입일") or row.get("입주일") or row.get("계약시작일") or row.get("시작일") or row.get("move_in") or "").strip()
    expiry = str(row.get("만기일") or row.get("계약종료일") or row.get("만료일") or row.get("종료일") or row.get("expiry") or "").strip()

    if not name and (deposit > 0 or rent > 0):
        name = "입주자"

    return {
        "room_number": room_n,
        "name": name,
        "phone": phone,
        "id_number": id_number,
        "deposit": deposit,
        "rent": rent,
        "maintenance": maintenance,
        "clean_fee": clean_fee,
        "move_in": move_in or today().isoformat(),
        "expiry": expiry
    }


@router.post("/smart/ocr-contract")
def smart_ocr_contract(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    """계약서/임대차 대장 카메라 사진 ➡️ OCR 텍스트 추출 및 계약 등록"""
    img = p.get("image_base64") or ""
    if not img:
        raise HTTPException(400, "분석할 이미지 데이터(base64)가 필요합니다.")
    res = ai_tools.read_contract_image(img)
    if not res.get("success"):
        return res
    
    bid = Building.canon(p.get("branch_id") or user.branch or "main")
    b = _b(bid)
    auto_apply = bool(p.get("auto_apply", True))
    clear_before_import = bool(p.get("clear_before_import", True))
    saved_contracts = []

    try:
        # 정규화된 계약 행 준비
        normalized_rows = []
        for raw_row in res.get("rows", []):
            norm = _normalize_contract_row(raw_row)
            if norm.get("room_number") and b.valid_room(norm["room_number"]):
                normalized_rows.append(norm)

        if auto_apply and normalized_rows:
            # 건물 서브클래스(SunhoBuilding / SinbiBuilding / ChicvillBuilding)의 전용 reset_and_import 실행
            import_res = b.reset_and_import(normalized_rows, clear_existing=clear_before_import)
            saved_contracts = [act.model_dump() for u in b.view() if (act := u.active()) is not None]
        elif auto_apply:
            for raw_row in res.get("rows", []):
                norm = _normalize_contract_row(raw_row)
                room_n = norm["room_number"]
                if room_n and b.valid_room(room_n):
                    b.add_unit(room_n)
                    u = b.unit(room_n)
                    c = u.update({
                        "name": norm["name"],
                        "phone": norm["phone"],
                        "id_number": norm["id_number"],
                        "deposit": norm["deposit"],
                        "rent": norm["rent"],
                        "maintenance": norm["maintenance"],
                        "clean_fee": norm["clean_fee"],
                        "move_in": norm["move_in"],
                        "expiry": norm["expiry"]
                    })
                    if c:
                        saved_contracts.append(c.model_dump())

        ok = len(saved_contracts) > 0
        return {
            "success": ok,
            "ocr_kind": "contract",
            "branch_id": bid,
            "building_type": getattr(b, "BUILDING_TYPE", "base"),
            "total_extracted": len(res.get("rows", [])),
            "applied_count": len(saved_contracts),
            "extracted_rows": res.get("rows", []),
            "applied_contracts": saved_contracts,
            "message": f"[{b.name}] 총 {len(saved_contracts)}개 호실의 임대차 계약 정보가 성공적으로 등록(기존 데이터 정화 및 교체 완료)되었습니다!" if ok else f"{len(res.get('rows', []))}건의 항목이 분석되었으나 유효한 세입자 정보가 없습니다."
        }
    except Exception as e:
        return {
            "success": False,
            "ocr_kind": "contract",
            "branch_id": bid,
            "error": str(e),
            "message": f"계약 대장 등록 처리 중 오류가 발생했습니다: {str(e)}"
        }


@router.post("/smart/ocr-receipt")
def smart_ocr_receipt(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    """영수증 카메라 사진 ➡️ OCR 텍스트 추출 및 지출 전표 등록"""
    img = p.get("image_base64") or ""
    if not img:
        raise HTTPException(400, "분석할 이미지 데이터(base64)가 필요합니다.")
    res = ai_tools.read_receipt_image(img)
    if not res.get("success"):
        return res

    data = res.get("data") or {}
    bid = Building.canon(user.branch or p.get("branch_id") or "main")
    auto_apply = bool(p.get("auto_apply", True))
    exp_obj = None

    if auto_apply and data.get("amount"):
        exp_obj = Expense(
            building_id=bid,
            date=data.get("date") or today().isoformat(),
            item=data.get("item") or "지출",
            amount=num(data.get("amount")),
            receipt_type=data.get("receipt_type") or "신용카드",
            note=data.get("note") or "스마트 영수증 스캔"
        ).save("ocr_scanned")

    return {
        "success": True,
        "extracted": data,
        "expense": exp_obj.model_dump() if exp_obj else None,
        "message": f"영수증 지출({num(data.get('amount')):,}원)이 인식되어 등록되었습니다." if exp_obj else "영수증이 인식되었습니다."
    }


# ── 종합소득세 및 세무 보고서 ──
@router.get("/tax/income-tax")
def get_income_tax_report(branch_id: str = "main", year: Optional[int] = None, user: User = Depends(me)):
    b = _b(branch_id, user)
    return vat.income_tax_report(b, year)


@router.get("/tax/income-tax/excel")
def download_income_tax_excel(branch_id: str = "main", year: Optional[int] = None, user: User = Depends(me)):
    b = _b(branch_id, user)
    rep = vat.income_tax_report(b, year)
    y = rep["year"]
    return _attach(vat.income_tax_excel_bytes(rep), "application/vnd.ms-excel", f"{b.name}_종합소득세_{y}년.xls")


@router.get("/tax/income-tax/csv")
def download_income_tax_csv(branch_id: str = "main", year: Optional[int] = None, user: User = Depends(me)):
    b = _b(branch_id, user)
    rep = vat.income_tax_report(b, year)
    y = rep["year"]
    return _attach(vat.income_tax_csv_bytes(rep), "text/csv; charset=utf-8", f"{b.name}_종합소득세_{y}년.csv")

