"""
api.py — 기존 rent 프런트엔드와 100% 호환되는 REST 레이어 + 객체/AI 신규 엔드포인트.
라우터는 HTTP ↔ 객체 호출 변환만 한다. 규칙은 전부 도메인 객체 안에 있다.
"""
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Response

from .domain import ALIASES, Building, agent, ask, parser
from .domain import ai_tools, vat
from .domain.rent import Contract, Expense, Unit, num, today
from .kernel.base import recall, store
from .kernel.identity import UpgradeRequest, User

router = APIRouter()
Body_ = Body(default={})


def _b(ref: Optional[str]) -> Building:
    return Building.require(ref)


def _unit(branch_id: Optional[str], n: int) -> Unit:
    return _b(branch_id).unit(n)


def me(authorization: str = Header("")) -> User:
    u = User.from_token(authorization)
    if not u:
        raise HTTPException(401, "로그인이 필요합니다.")
    return u


# ── 상태 / 건물 ──
@router.get("/status")
def system_status():
    bs = Building.all()
    stats = [b.stats() for b in bs]
    total, vacant = sum(s["total_rooms"] for s in stats), sum(s["vacant_rooms"] for s in stats)
    return {"app_id": "rent2", "app_name": "원룸 임차관리 (객체 모델)", "status": "HEALTHY", "deployment_mode": "LOCAL_STANDALONE",
            "total_rooms": total, "active_contracts": total - vacant, "vacant_rooms": vacant, "branches_count": len(bs),
            "expenses_total": sum(e.amount for e in Expense.all()), "objects": store().count()}


@router.get("/branches")
def list_branches(active_only: bool = False):
    bs = [b for b in Building.all() if b.is_active or not active_only]
    return {"success": True, "total": len(bs), "branches": [_branch(b) for b in bs]}


def _branch(b: Building) -> Dict[str, Any]:
    d = b.model_dump()
    return {**{k: d[k] for k in ("id", "name", "contact_phone", "address", "fee_plan", "monthly_fee", "billing_status",
                                 "billing_due_day", "last_paid_at", "is_active")}, "branch_id": b.id}


@router.post("/branches", status_code=201)
def create_branch(p: Dict[str, Any] = Body(...)):
    bid = (p.get("branch_id") or "").strip()
    if not bid or Building.get(bid):
        raise HTTPException(400, "이미 존재하는 건물/지점 ID이거나 ID가 비어 있습니다.")
    b = Building(id=bid, name=p.get("name") or bid, contact_phone=p.get("contact_phone") or "", address=p.get("address") or "",
                 fee_plan=p.get("fee_plan") or "원룸 프리미엄 29실형", monthly_fee=num(p.get("monthly_fee") or 150000),
                 billing_due_day=num(p.get("billing_due_day") or 25), aliases=ALIASES.get(bid, [])).save("created")
    return _branch(b)


@router.get("/branches/{bid}")
def get_branch(bid: str):
    return _branch(_b(bid))


@router.patch("/branches/{bid}")
def update_branch(bid: str, p: Dict[str, Any] = Body(...)):
    return _branch(_b(bid).update(p))


@router.patch("/branches/{bid}/billing")
def update_billing(bid: str, p: Dict[str, Any] = Body(...)):
    return _branch(_b(bid).update({"billing_status": p.get("billing_status"), "last_paid_at": p.get("last_paid_at")}))


@router.delete("/branches/{bid}")
def delete_branch(bid: str):
    b = _b(bid)
    if b.id == "main":
        raise HTTPException(400, "기본 본사 부동산(시크빌)은 삭제할 수 없습니다.")
    b.destroy()
    return {"success": True, "branch_id": b.id, "message": f"'{b.name}' 부동산과 관련 데이터가 성공적으로 삭제되었습니다."}


@router.post("/branches/{bid}/reset")
def reset_branch(bid: str, p: Dict[str, Any] = Body_):
    b = _b(bid)
    b.wipe()
    if (p.get("new_name") or "").strip():
        b.update({"name": p["new_name"].strip()})
    return {"success": True, "branch_id": b.id, "branch_name": b.name, "total_rooms": len(b.units),
            "message": f"'{b.name}' 부동산의 모든 수납 장부와 임차인 정보가 초기화(공실화)되었습니다."}


@router.post("/system/factory-reset")
def factory_reset(p: Dict[str, Any] = Body_):
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
def get_rooms(branch_id: str = "main", year: Optional[int] = None):
    b = _b(branch_id)
    rooms = b.rooms(year)
    return {"success": True, "branch_id": b.id, "total_rooms": len(rooms), "selected_room": min(rooms, default=101), "rooms": rooms}


@router.get("/rooms/{n}")
def get_room(n: int, branch_id: str = "main"):
    return _unit(branch_id, n).room()


@router.put("/rooms/{n}")
def update_room(n: int, form: Dict[str, Any] = Body(...), branch_id: str = "main"):
    u = _unit(branch_id, n)
    u.update(form)
    return u.room()


@router.post("/rooms/batch-import")
def batch_import(rows: List[Dict[str, Any]] = Body(...), branch_id: str = "main", clear_existing: bool = True):
    return _b(branch_id).import_rooms(rows, clear_existing)


@router.post("/rooms/reset")
def reset_rooms(branch_id: str = "main"):
    b = _b(branch_id)
    b.wipe()
    b.units = []
    b.save("rooms_reset")
    return {"success": True, "branch_id": b.id, "message": "모든 호실 데이터가 초기화되었습니다."}


@router.post("/rooms/ocr-import")
def ocr_import(p: Dict[str, Any] = Body(...), branch_id: str = "main"):
    if not p.get("image_base64"):
        raise HTTPException(400, "이미지 데이터가 전달되지 않았습니다.")
    return ai_tools.read_contract_image(p["image_base64"])


@router.post("/rooms/fill-payments")
def fill_payments(p: Dict[str, Any] = Body_, branch_id: str = "main"):
    """현재 세입자 기준으로 장부를 규칙값으로 재계산 (수동 기록을 지우고 계산식으로 되돌림)"""
    b, only = _b(branch_id), (num(p.get("room_number")) or None)
    done = [u.number for u in b.view() if u.active() and (only is None or u.number == only) and (u.reset_ledger() or True)]
    return {"success": True, "updated_rooms": done, "count": len(done), "message": f"{len(done)}개 호실의 전입일 기준 납부내역이 동기화되었습니다."}


@router.post("/rooms/{n}/payment")
def pay(n: int, p: Dict[str, Any] = Body(...), branch_id: str = "main"):
    u = _unit(branch_id, n)
    u.pay(num(p.get("month")), p.get("year"), p.get("paid_date"), p.get("note") or "정상 입금", p.get("tenant_name"),
          p.get("rent_amount"), p.get("maintenance_amount"))
    return u.room()


@router.post("/rooms/{n}/cancel-payment")
def cancel(n: int, p: Dict[str, Any] = Body(...), branch_id: str = "main"):
    u = _unit(branch_id, n)
    u.cancel(num(p.get("month")), p.get("year"), p.get("note"))
    return u.room()


@router.post("/payments/batch-collect")
@router.post("/branches/{bid}/payments/batch-collect")
def batch_collect(p: Dict[str, Any] = Body(...), bid: Optional[str] = None):
    return _b(bid or p.get("branch_id")).collect(p.get("year"), num(p.get("start_month") or 1), num(p.get("end_month") or 10),
                                                 p.get("payment_date_mode") or "contract", p.get("specific_date"),
                                                 p.get("note") or "정상 입금 (일괄 수납)", bool(p.get("include_unoccupied")))


@router.post("/payments/matrix-import")
@router.post("/branches/{bid}/payments/matrix-import")
def matrix_import(p: Dict[str, Any] = Body(...), bid: Optional[str] = None):
    rows = p.get("rooms") or p.get("matrix_rooms") or []
    if not isinstance(rows, list):
        raise HTTPException(400, "rooms 배열 데이터가 필요합니다.")
    return _b(bid or p.get("branch_id")).import_matrix(rows)


# ── 이력 / 만기 / 지출 ──
@router.get("/tenant-histories")
def tenant_histories(branch_id: str = "main", room_number: Optional[int] = None):
    hs = [h.history_row() for h in _b(branch_id).histories(room_number)]
    return {"success": True, "total": len(hs), "histories": hs}


@router.delete("/tenant-histories/expired")
def purge_expired(branch_id: str = "main"):
    b = _b(branch_id)
    before = sum(1 for c in Contract.find(b.id) if not c.active)
    after = len(b.histories())
    return {"success": True, "branch_id": b.id, "purged_count": before - after,
            "message": f"전출 후 1년이 경과한 세입자 이력 {before - after}건이 영구 정리되었습니다."}


@router.delete("/tenant-histories/{hid}")
def delete_history(hid: str, branch_id: str = "main"):
    b = _b(branch_id)
    c = Contract.get(hid) or (next(iter(b.unit(int(hid)).ended()), None) if hid.isdigit() else None)
    if not c or c.building_id != b.id or c.active:
        raise HTTPException(404, "삭제할 전출 이력을 찾을 수 없습니다.")
    c.delete("history_deleted")
    return {"success": True, "message": f"[{c.unit}호] {c.tenant_name}님의 전출 이력이 성공적으로 삭제되었습니다."}


@router.get("/expiring-rooms")
def expiring(branch_id: str = "main", days_window: int = 65):
    b = _b(branch_id)
    rows = b.expiring(days_window)
    return {"success": True, "branch_id": b.id, "total": len(rows), "rooms": rows}


def _exp(e: Expense) -> Dict[str, Any]:
    return {**e.model_dump(), "branch_id": e.building_id}


@router.get("/expenses")
def list_expenses(branch_id: str = "main"):
    es = _b(branch_id).expenses()
    return {"success": True, "total": len(es), "total_amount": sum(e.amount for e in es), "expenses": [_exp(e) for e in es]}


@router.post("/expenses", status_code=201)
def create_expense(p: Dict[str, Any] = Body(...), branch_id: str = "main"):
    return _exp(Expense(building_id=_b(branch_id).id, date=p.get("date") or today().isoformat(), item=p.get("item") or "지출",
                        amount=num(p.get("amount")), note=p.get("note") or "", receipt_type=p.get("receipt_type") or "",
                        receipt_info=p.get("receipt_info") or "").save())


@router.delete("/expenses/{eid}")
def delete_expense(eid: str, branch_id: str = "main"):
    e = Expense.get(eid)
    if not e or e.building_id != _b(branch_id).id:
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
               year: Optional[int] = None, room_numbers: Optional[str] = None):
    if start_month > end_month:
        raise HTTPException(400, "시작월은 종료월보다 클 수 없습니다.")
    return vat.report(_b(branch_id), start_month, end_month, year, _rooms_csv(room_numbers))


@router.get("/vat-report/download")
def vat_download(branch_id: str = "main", start_month: int = Query(1, ge=1, le=12), end_month: int = Query(6, ge=1, le=12),
                 year: Optional[int] = None, format_type: str = Query("excel", pattern="^(excel|csv)$"), room_numbers: Optional[str] = None):
    if start_month > end_month:
        raise HTTPException(400, "시작월은 종료월보다 클 수 없습니다.")
    d = vat.report(_b(branch_id), start_month, end_month, year, _rooms_csv(room_numbers))
    stem, csv = f"부동산_부가세_수납현황_{d['year']}년_{start_month}월_{end_month}월", format_type == "csv"
    return _attach(vat.csv_bytes(d) if csv else vat.excel_bytes(d), "text/csv; charset=utf-8" if csv else "application/vnd.ms-excel; charset=utf-8",
                   stem + (".csv" if csv else ".xls"))


@router.get("/vat-settings")
def get_vat_settings(branch_id: str = "main"):
    b = _b(branch_id)
    return {"success": True, "branch_id": b.id, "vat_target_rooms": b.vat_target_rooms}


@router.post("/vat-settings")
def save_vat_settings(p: Dict[str, Any] = Body(...)):
    b = _b(p.get("branch_id"))
    b.vat_target_rooms = sorted(set(num(r) for r in p.get("vat_target_rooms") or []))
    b.save("vat_settings")
    return {"success": True, "branch_id": b.id, "vat_target_rooms": b.vat_target_rooms,
            "message": f"부가세 대상 호실 {len(b.vat_target_rooms)}개실 설정이 영구 저장되었습니다."}


@router.get("/backup/download")
def backup_download(branch_id: str = "main"):
    import json
    b = _b(branch_id)
    return _attach(json.dumps(b.backup(), ensure_ascii=False, indent=2).encode(), "application/json; charset=utf-8",
                   f"{b.name}_전체백업_{datetime.now():%Y%m%d_%H%M%S}.json")


@router.post("/backup/restore")
def backup_restore(payload: Dict[str, Any], target_branch_id: str = "main"):
    return _b(target_branch_id).restore(payload.get("data", payload))


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
    return {"success": True, "user_id": u.id, "username": u.username, "name": u.name, "role": u.role, "assigned_branch_id": u.branch,
            "redirect_url": "/rent/branches.html" if u.role == "superadmin" else (f"/rent/?branch={u.branch}" if u.branch else "/rent/"),
            "access_token": u.token()}


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
    scope = Building.canon(user.branch or building) if (user.branch or building) else None
    if scope and not user.can("read", scope):
        raise HTTPException(403, "조회 권한이 없습니다.")
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
    return ask(msg, user, p.get("building") or "", p.get("mode") or "confirm")


@router.post("/ai/execute")
def ai_execute(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    try:
        out = agent.confirm(p.get("pending_id", ""), user)
    except LookupError as e:
        raise HTTPException(404, str(e))
    return {"success": True, "result": out, "message": agent.say(out)}


# ── 스마트 인제스트 (카메라 / 클립보드 붙여넣기 자동화) ──
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
        parsed_list = [single] if single["room_number"] else []
        
    if not parsed_list:
        return {"success": False, "message": "입금 문자에서 호실 또는 금액을 추출하지 못했습니다.", "items": []}

    auto_apply = bool(p.get("auto_apply", True))
    applied = []
    b = _b(bid)

    for item in parsed_list:
        room = item["room_number"]
        if room in b.units and auto_apply and item["amount"] > 0:
            u = b.unit(room)
            pay_obj = u.pay(
                month=item["target_month"],
                year=item["target_year"],
                paid_date=item["paid_date"],
                note=f"문자 자동수납 ({item['detected_tenant'] or '입금자'} {item['amount']:,}원)",
                rent_amount=item["amount"]
            )
            item["applied"] = True
            item["payment_id"] = pay_obj.id
            applied.append(item)
        else:
            item["applied"] = False

    return {
        "success": True,
        "branch_id": bid,
        "total_parsed": len(parsed_list),
        "applied_count": len(applied),
        "items": parsed_list,
        "message": f"총 {len(parsed_list)}건의 입금 내역 중 {len(applied)}건이 자동 수납 처리되었습니다."
    }


@router.post("/smart/ocr-contract")
def smart_ocr_contract(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    """계약서 카메라 사진 ➡️ OCR 텍스트 추출 및 계약 등록"""
    img = p.get("image_base64") or ""
    if not img:
        raise HTTPException(400, "분석할 이미지 데이터(base64)가 필요합니다.")
    res = ai_tools.read_contract_image(img)
    if not res.get("success"):
        return res
    
    bid = Building.canon(user.branch or p.get("branch_id") or "main")
    b = _b(bid)
    auto_apply = bool(p.get("auto_apply", False))
    saved_contracts = []

    for row in res.get("rows", []):
        room_n = num(row.get("호실") or row.get("room_number") or row.get("room"))
        if room_n and auto_apply:
            u = b.unit(room_n)
            c = u.update({
                "name": row.get("세입자") or row.get("name") or "",
                "phone": row.get("연락처") or row.get("phone") or "",
                "id_number": row.get("주민등록번호") or row.get("id_number") or "",
                "deposit": num(row.get("보증금") or row.get("deposit")),
                "rent": num(row.get("월세") or row.get("rent")),
                "maintenance": num(row.get("관리비") or row.get("maintenance")),
                "move_in": row.get("전입일") or row.get("move_in") or today().isoformat(),
                "expiry": row.get("만기일") or row.get("expiry") or ""
            })
            if c:
                saved_contracts.append(c.model_dump())

    return {
        "success": True,
        "extracted_rows": res.get("rows", []),
        "applied_contracts": saved_contracts,
        "message": f"{len(res.get('rows', []))}건의 계약서 항목이 인식되었습니다."
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
def get_income_tax_report(branch_id: str = "main", year: Optional[int] = None):
    b = _b(branch_id)
    return vat.income_tax_report(b, year)


@router.get("/tax/income-tax/excel")
def download_income_tax_excel(branch_id: str = "main", year: Optional[int] = None):
    b = _b(branch_id)
    rep = vat.income_tax_report(b, year)
    y = rep["year"]
    return _attach(vat.income_tax_excel_bytes(rep), "application/vnd.ms-excel", f"{b.name}_종합소득세_{y}년.xls")


@router.get("/tax/income-tax/csv")
def download_income_tax_csv(branch_id: str = "main", year: Optional[int] = None):
    b = _b(branch_id)
    rep = vat.income_tax_report(b, year)
    y = rep["year"]
    return _attach(vat.income_tax_csv_bytes(rep), "text/csv; charset=utf-8", f"{b.name}_종합소득세_{y}년.csv")

