"""
apps/rent2/backend/routers/smart.py
스마트 인제스트 (클립보드 입력 자동 판별, 만능 붙여넣기, 입금문자 파싱 수납, 영수증/계약서 OCR)
구글 스프레드시트 2025/2026 실시간 동기화, JSON 전체 백업/복원, AI 질의 비서 및 오브젝트 기억
"""
import base64
import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException

from ..domain import Building, agent, ask, parser
from ..domain import ai_tools
from ..domain.rent import Expense, num, today
from ..kernel.base import recall, store
from ..kernel.identity import User
from .common import file_response, get_building, me, resolve_bid

router = APIRouter()
Body_ = Body(default={})


# ── AI 질의 비서 & 오브젝트 타임라인 ──
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
    return {
        "tools": [{"name": t.name, "description": t.doc, "write": t.write, "params": list(t.params)} for t in agent.TOOLS.values()],
        "engine": "gemini" if agent.api_key() else "offline"
    }


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


# ── 백업 및 복원 ──
@router.get("/backup/download")
def backup_download(branch_id: str = "main", user: User = Depends(me)):
    b = get_building(branch_id, user)
    return file_response(
        json.dumps(b.backup(), ensure_ascii=False, indent=2).encode(),
        "application/json; charset=utf-8",
        f"{b.name}_전체백업_{datetime.now():%Y%m%d_%H%M%S}.json"
    )


@router.post("/backup/restore")
def backup_restore(payload: Dict[str, Any], target_branch_id: str = "main", user: User = Depends(me)):
    if user.role != "superadmin":
        raise HTTPException(403, "본사 최고관리자만 전체 백업 데이터를 복원할 수 있습니다.")
    return get_building(target_branch_id, user).restore(payload.get("data", payload))


# ── 구글 시트 동기화 ──
@router.post("/sync/google-sheet")
def sync_google_sheet(p: Dict[str, Any] = Body_, branch_id: str = "main", user: User = Depends(me)):
    from ..domain import sheet_sync
    url = (p.get("sheet_url") or "").strip() or sheet_sync.DEFAULT_SHEET_URL
    bid = resolve_bid(branch_id, user)
    try:
        res = sheet_sync.sync_sheet_data(url, bid)
        return res
    except Exception as e:
        raise HTTPException(500, f"구글 스프레드시트 동기화 실패: {str(e)}")


# ── 스마트 인제스트 (지능형 판별 & 처리) ──
@router.post("/smart/detect-input")
def detect_input_type(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    text = (p.get("text") or "").strip()
    img = (p.get("image_base64") or "").strip()
    bid = Building.canon(user.branch or p.get("branch_id") or "main")

    if img or text.startswith("data:image/"):
        return {
            "kind": "image",
            "title": "📷 사진 / 이미지 감지됨",
            "description": "클립보드 또는 파일로 붙여넣은 사진 데이터입니다.",
            "action_label": "⚡ 사진 AI 분석 및 자동 등록",
            "default_scan_kind": "receipt"
        }

    if "docs.google.com/spreadsheets" in text:
        return {
            "kind": "google_sheet",
            "title": "📊 구글 스프레드시트 링크 감지됨",
            "description": "시크빌 2025/2026년 장부 스프레드시트입니다.",
            "action_label": "🔄 2025/2026 장부 실시간 동기화",
            "url": text
        }

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

    return {
        "kind": "text",
        "title": "📝 텍스트 입력",
        "description": "입력된 내용을 분석하여 적절한 처리 방식을 안내합니다.",
        "action_label": "입금 수납 또는 처리 시도"
    }


@router.post("/smart/universal-ingest")
def universal_ingest(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    text = (p.get("text") or "").strip()
    img = (p.get("image_base64") or "").strip()
    bid = Building.canon(user.branch or p.get("branch_id") or "main")
    scan_kind = p.get("scan_kind") or "receipt"

    if img or text.startswith("data:image/"):
        target_img = img or text
        if scan_kind == "contract":
            return smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
        else:
            return smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)

    if "docs.google.com/spreadsheets" in text:
        from ..domain import sheet_sync
        res = sheet_sync.sync_sheet_data(text, bid)
        return {
            "success": True,
            "kind": "google_sheet",
            "message": f"구글 스프레드시트 2025/2026년 장부 동기화가 완료되었습니다!\n- 동기화 호실: {res['total_rooms']}개실\n- 총 납부내역 반영: {res['total_payments_synced']}건",
            "data": res
        }

    clean_path = re.sub(r"^file:///?", "", text.strip('"\'; \t\r\n'))
    looks_like_file = bool(re.search(r"\.(xlsx|xls|csv|tsv|png|jpg|jpeg|webp|pdf)$", clean_path, re.I) or re.match(r"^[a-zA-Z]:[\\/]", clean_path))
    if looks_like_file:
        if not os.path.exists(clean_path):
            raise HTTPException(400, f"지정된 로컬 파일을 찾을 수 없습니다: {clean_path}")
        ext = os.path.splitext(clean_path)[1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".pdf"):
            with open(clean_path, "rb") as f:
                b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("utf-8")
            if scan_kind == "contract":
                return smart_ocr_contract({"image_base64": b64, "branch_id": bid, "auto_apply": True}, user)
            else:
                return smart_ocr_receipt({"image_base64": b64, "branch_id": bid, "auto_apply": True}, user)
        elif ext in (".xlsx", ".xls", ".csv", ".tsv"):
            from ..domain import sheet_sync
            res = sheet_sync.sync_file_data(clean_path, bid)
            return {
                "success": True,
                "kind": "file_excel",
                "message": f"로컬 장부 파일({os.path.basename(clean_path)}) 2025/2026년 동기화가 완료되었습니다!\n- 동기화 호실: {res['total_rooms']}개실\n- 총 납부내역 반영: {res['total_payments_synced']}건",
                "data": res
            }

    res = smart_paste_payment({"text": text, "branch_id": bid, "auto_apply": True}, user)
    res["kind"] = "bank_payment"
    return res


@router.post("/smart/paste-payment")
def smart_paste_payment(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    text = (p.get("text") or "").strip()
    bid = Building.canon(user.branch or p.get("branch_id") or "main")
    if not text:
        raise HTTPException(400, "분석할 문자 또는 카톡 텍스트를 입력해 주세요.")
    
    parsed_list = parser.parse_batch_bank_messages(text, bid)
    if not parsed_list:
        single = parser.parse_bank_message(text, bid)
        parsed_list = [single] if single.get("room_number") else []
        
    if not parsed_list:
        return {"success": False, "message": "입금 문자에서 호실 번호(예: 403호 또는 403)를 찾지 못했습니다.", "items": []}

    auto_apply = bool(p.get("auto_apply", True))
    applied = []
    b = get_building(bid)

    for item in parsed_list:
        room = item["room_number"]
        if room in b.units and auto_apply:
            u = b.unit(room)
            amt = item["amount"]
            if amt <= 0:
                c = u.active()
                amt = (c.monthly_rent + c.maintenance) if c else 0

            if amt > 0:
                note_suffix = " (계약금액 자동적용)" if item.get("is_fallback_amount") or item["amount"] == 0 else ""
                pay_obj, app_y, app_m, was_oldest = u.pay_fifo(
                    paid_date=item["paid_date"],
                    note=f"문자 자동수납 ({item['detected_tenant'] or '입금자'} {amt:,}원{note_suffix})",
                    tenant_name=item.get("detected_tenant"),
                    rent_amount=amt,
                    fallback_month=item["target_month"],
                    fallback_year=item["target_year"]
                )
                item["applied"] = True
                item["applied_amount"] = amt
                item["applied_year"] = app_y
                item["applied_month"] = app_m
                item["was_oldest_unpaid"] = was_oldest
                item["payment_id"] = pay_obj.id
                applied.append(item)
            else:
                item["applied"] = False
        else:
            item["applied"] = False

    ok = len(applied) > 0
    return {
        "success": ok,
        "branch_id": bid,
        "total_parsed": len(parsed_list),
        "applied_count": len(applied),
        "items": parsed_list,
        "message": f"총 {len(parsed_list)}건 중 {len(applied)}건이 자동 수납 처리되었습니다." if ok else "호실 계약 정보 또는 입금 금액을 확인하지 못했습니다."
    }


@router.post("/smart/ocr-contract")
def smart_ocr_contract(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    img = p.get("image_base64") or ""
    if not img:
        raise HTTPException(400, "분석할 이미지 데이터(base64)가 필요합니다.")
    res = ai_tools.read_contract_image(img)
    if not res.get("success"):
        return res
    
    bid = Building.canon(user.branch or p.get("branch_id") or "main")
    b = get_building(bid)
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
