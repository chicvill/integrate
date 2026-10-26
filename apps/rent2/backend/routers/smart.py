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
    if user.role != "superadmin":
        raise HTTPException(403, "타임라인 감사 로그는 본사 최고관리자만 조회할 수 있습니다.")
    scope = Building.canon(user.branch or building) if (user.branch or building) else None
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

        # 1) 입금 알림 지정 요청인 경우
        if scan_kind == "bank_sms":
            sms_res = ai_tools.read_bank_sms_image(target_img)
            res: Dict[str, Any] = {"success": False, "applied_count": 0, "message": "분석 실패"}
            if sms_res.get("success") and sms_res.get("text"):
                # 계약 대장 표 패턴 우선 감지
                roster_cands = parser.parse_contract_roster(sms_res["text"])
                if len(roster_cands) >= 2 or (roster_cands and any(r.get("deposit") or r.get("rent") for r in roster_cands)):
                    con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
                    if con_res.get("success") and num(con_res.get("applied_count")) > 0:
                        return con_res

                # 은행 입금 수납 처리 시도
                res = smart_paste_payment({"text": sms_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = sms_res["text"]
                if res.get("success") and num(res.get("applied_count")) > 0:
                    return res

            # 수납 처리가 안 된 경우(계약 대장 사진이거나 지출 영수증인 경우) 자동 스마트 폴백!
            con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if con_res.get("success") and num(con_res.get("applied_count")) > 0:
                return con_res
            rec_res = smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if rec_res.get("success") and (rec_res.get("expense") or (rec_res.get("data") and rec_res["data"].get("amount"))):
                return rec_res

            if sms_res.get("success") and sms_res.get("text"):
                return res
            raise HTTPException(400, sms_res.get("message") or "입금 알림 사진에서 글자를 인식하지 못했습니다.")

        # 2) 계약 대장 지정 요청인 경우
        elif scan_kind == "contract":
            con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            # 입금 알림 사진으로 자동 감지된 경우 즉시 수납 처리로 연계
            if con_res.get("kind") == "bank_sms" and con_res.get("text"):
                res = smart_paste_payment({"text": con_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = con_res["text"]
                return res
            if con_res.get("success") and num(con_res.get("applied_count")) > 0:
                return con_res
            rec_res = smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            return rec_res if (rec_res.get("success") and rec_res.get("expense")) else con_res

        # 3) 지출 영수증 지정 요청인 경우
        elif scan_kind == "receipt":
            rec_res = smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if rec_res.get("success") and (rec_res.get("expense") or (rec_res.get("data") and rec_res["data"].get("amount"))):
                return rec_res
            con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if con_res.get("kind") == "bank_sms" and con_res.get("text"):
                res = smart_paste_payment({"text": con_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = con_res["text"]
                return res
            if con_res.get("success") and num(con_res.get("applied_count")) > 0:
                return con_res
            return rec_res

        # 4) AI 스마트 자동 판별
        else:
            con_res = smart_ocr_contract({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if con_res.get("kind") == "bank_sms" and con_res.get("text"):
                res = smart_paste_payment({"text": con_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = con_res["text"]
                return res
            if con_res.get("success") and num(con_res.get("applied_count")) > 0:
                return con_res

            rec_res = smart_ocr_receipt({"image_base64": target_img, "branch_id": bid, "auto_apply": True}, user)
            if rec_res.get("success") and (rec_res.get("expense") or (rec_res.get("data") and rec_res["data"].get("amount"))):
                return rec_res

            sms_res = ai_tools.read_bank_sms_image(target_img)
            if sms_res.get("success") and sms_res.get("text"):
                res = smart_paste_payment({"text": sms_res["text"], "branch_id": bid, "auto_apply": True}, user)
                res["kind"] = "bank_payment"
                res["extracted_text"] = sms_res["text"]
                if res.get("success") and num(res.get("applied_count")) > 0:
                    return res

            return con_res if con_res.get("success") else rec_res

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

    # 2.5 엑셀 복사-붙여넣기(Tab 구분자) 또는 여러 호실 계약 대장 텍스트인 경우:
    has_tab = "\t" in text
    has_multi_rooms = len(re.findall(r"\b\d{3,4}\s*호?\b", text)) >= 2
    if has_tab or has_multi_rooms:
        roster_res = ai_tools.import_contract_roster(bid, text)
        return {
            "success": True,
            "kind": "contract_roster",
            "message": roster_res["message"],
            "count": roster_res["count"],
            "data": roster_res
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
        parsed_list = [single] if (single.get("room_number") or single.get("detected_tenant")) else []
        
    if not parsed_list:
        return {"success": False, "message": "입금 문자에서 호실 번호(예: 403호) 또는 입금자명(세입자)을 찾지 못했습니다.", "items": []}

    auto_apply = bool(p.get("auto_apply", True))
    applied = []
    b = get_building(bid)

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
    auto_apply = bool(p.get("auto_apply", True))
    clear_before_import = bool(p.get("clear_before_import", True))
    saved_contracts = []

    try:
        normalized_rows = []
        for raw_row in res.get("rows", []):
            rn = num(raw_row.get("호실") or raw_row.get("room_number") or raw_row.get("room") or raw_row.get("unit"))
            if rn and b.valid_room(rn):
                normalized_rows.append({
                    "room_number": rn,
                    "name": str(raw_row.get("세입자") or raw_row.get("name") or "").strip(),
                    "phone": str(raw_row.get("연락처") or raw_row.get("phone") or "").strip(),
                    "id_number": str(raw_row.get("주민등록번호") or raw_row.get("id_number") or "").strip(),
                    "deposit": num(raw_row.get("보증금") or raw_row.get("deposit")),
                    "rent": num(raw_row.get("월세") or raw_row.get("rent")),
                    "maintenance": num(raw_row.get("관리비") or raw_row.get("maintenance")),
                    "clean_fee": num(raw_row.get("청소비") or raw_row.get("clean_fee")),
                    "move_in": raw_row.get("전입일") or raw_row.get("move_in") or today().isoformat(),
                    "expiry": raw_row.get("만기일") or raw_row.get("expiry") or ""
                })

        if auto_apply and normalized_rows:
            import_res = b.reset_and_import(normalized_rows, clear_existing=clear_before_import)
            saved_contracts = [act.model_dump() for u in b.view() if (act := u.active()) is not None]

        ok = len(saved_contracts) > 0
        return {
            "success": ok,
            "ocr_kind": "contract",
            "branch_id": bid,
            "extracted_rows": res.get("rows", []),
            "applied_contracts": saved_contracts,
            "applied_count": len(saved_contracts),
            "message": f"총 {len(res.get('rows', []))}건 중 {len(saved_contracts)}개 호실 계약이 자동 등록·동기화되었습니다." if ok else f"{len(res.get('rows', []))}건의 항목이 분석되었으나 유효한 세입자 정보가 없습니다."
        }
    except Exception as e:
        return {
            "success": False,
            "ocr_kind": "contract",
            "branch_id": bid,
            "error": str(e),
            "message": f"계약 대장 등록 처리 중 오류: {str(e)}"
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
