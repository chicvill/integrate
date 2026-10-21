"""
domain/ai_tools.py — 임차 객체를 AI 도구로 노출 (함수 하나 = 도구 하나, 스키마는 자동 생성).

새 AI 기능을 추가하는 비용 = 객체 행동을 부르는 함수 5줄 + @tool.
SQL·테이블·조인 지식은 AI에게 전혀 필요 없다.
"""
import re
from typing import Any, Dict, List, Tuple

from ..kernel import agent
from ..kernel.agent import tool
from ..kernel.base import recall, store
from . import vat
from .rent import Building, Contract, Expense, num, pdate, today


def _ym(year: int, month: int) -> Tuple[int, int]:
    t = today()
    return (year or t.year), (month or t.month)


# ───────────── 읽기 도구 ─────────────
@tool()
def search(query: str, building: str = "") -> Dict[str, Any]:
    """기억 검색: 이름·호실·메모 등 키워드로 계약서/수납/지출/건물 객체를 찾는다."""
    hits = recall(query, ["contract", "payment", "expense", "building"], Building.canon(building) if building else None, 8)
    lines = [f"· [{h['kind']}] {h['summary']}" for h in hits]
    return {"count": len(hits), "items": [{"kind": h["kind"], "id": h["id"], "summary": h["summary"]} for h in hits],
            "message": f"'{query}' 관련 기억 {len(hits)}건\n" + "\n".join(lines) if hits else f"'{query}'와 관련된 기록을 찾지 못했습니다."}


@tool()
def building_summary(building: str = "") -> Dict[str, Any]:
    """건물 현황 요약: 호실 수, 공실, 이번 달 미납, 만기 임박, 지출 합계."""
    b, t = Building.require(building), today()
    s, unpaid, soon = b.stats(), b.unpaid(t.year, t.month), b.expiring(65)
    spent = sum(e.amount for e in b.expenses())
    return {**s, "unpaid": len(unpaid), "expiring": len(soon), "expenses_total": spent,
            "message": f"🏢 {b.name}: 총 {s['total_rooms']}실 (공실 {s['vacant_rooms']}) · {t.month}월 미납 {len(unpaid)}건 · 만기 임박 {len(soon)}건 · 누적 지출 {spent:,}원"}


@tool()
def unit_card(building: str, unit: int) -> Dict[str, Any]:
    """호실 카드: 현재 계약, 이번 달 납부 상태, 미납 월, 과거 임차인 이력을 한 번에 본다."""
    card = Building.require(building).unit(unit).card()
    hist = " / ".join(card["history"]) or "없음"
    return {**card, "message": f"🚪 {card['building']} {unit}호\n계약: {card['contract']}\n이번 달: {'납부' if card['this_month']['paid'] else '미납'} ({card['this_month']['note'] or '-'})\n미납 월: {', '.join(card['unpaid_months']) or '없음'}\n이력: {hist}"}


@tool()
def vacancies(building: str = "") -> Dict[str, Any]:
    """공실(빈 호실) 목록."""
    b = Building.require(building)
    empty = [u.number for u in b.view() if not u.active() or not u.active().tenant_name]
    return {"units": empty, "message": f"공실 {len(empty)}실: {', '.join(map(str, empty)) or '없음'}"}


@tool()
def unpaid(building: str = "", year: int = 0, month: int = 0) -> Dict[str, Any]:
    """미납 현황: 해당 월(기본 이번 달)에 납부되지 않은 호실과 금액."""
    b, (y, m) = Building.require(building), _ym(year, month)
    rows = b.unpaid(y, m)
    lines = [f"· {r['unit']}호 {r['tenant']} {r['amount']:,}원" for r in rows]
    return {"rows": rows, "message": f"{y}년 {m}월 미납 {len(rows)}건 ({sum(r['amount'] for r in rows):,}원)\n" + "\n".join(lines) if rows else f"{y}년 {m}월은 미납 내역이 없습니다. ✅"}


@tool()
def expiring_contracts(building: str = "", days: int = 65) -> Dict[str, Any]:
    """만기 임박 계약: 앞으로 N일(기본 65일) 안에 끝나는 계약."""
    rows = Building.require(building).expiring(days)
    lines = [f"· {r['room_number']}호 {r['name']} 만기 {r['expiry']} (D-{r['diff_days']}, {r['period_category']})" for r in rows]
    return {"rows": rows, "message": f"만기 임박 {len(rows)}건\n" + "\n".join(lines) if rows else f"{days}일 내 만기 도래 계약이 없습니다."}


@tool()
def vat_summary(building: str = "", start_month: int = 1, end_month: int = 6, year: int = 0) -> Dict[str, Any]:
    """부가세 요약: 기간별 순수 월세 합계, 공급가액, 부가세."""
    b, (y, _) = Building.require(building), _ym(year, 0)
    r = vat.report(b, start_month, end_month, y)
    return {k: r[k] for k in ("year", "start_month", "end_month", "total_collected", "total_supply", "total_vat")} | {
        "message": f"🧾 {y}년 {start_month}~{end_month}월 월세 합계 {r['total_collected']:,}원 → 공급가액 {r['total_supply']:,}원 + 부가세 {r['total_vat']:,}원"}


@tool()
def timeline(building: str = "", limit: int = 10) -> Dict[str, Any]:
    """최근 변경 타임라인: 누가(사람/AI) 언제 무엇을 바꿨는지."""
    ev = store().timeline(Building.canon(building) if building else None, limit=limit)
    lines = [f"· {e['at'][5:16].replace('T', ' ')} {e['actor']} {e['kind']}.{e['action']} {e['detail'].get('summary', '')}" for e in ev]
    return {"events": ev, "message": "최근 변경 기록\n" + "\n".join(lines) if ev else "기록이 없습니다."}


# ───────────── 쓰기 도구 (사용자 확인 후 실행) ─────────────
@tool(write=True)
def record_payment(building: str, unit: int, month: int = 0, year: int = 0, paid_date: str = "") -> Dict[str, Any]:
    """납부 처리: 해당 호실의 월 임대료·관리비를 입금 완료로 기록한다 (기본: 가장 오래된 미납월부터 충당)."""
    u = Building.require(building).unit(unit)
    if month > 0:
        y = year or today().year
        p = u.pay(month, y, paid_date or None)
        app_y, app_m, was_oldest = y, month, False
    else:
        p, app_y, app_m, was_oldest = u.pay_fifo(paid_date=paid_date or None)
    old_str = " (오래된 미납분 우선 충당)" if was_oldest else ""
    return {"payment": p.id, "message": f"✅ {unit}호 {app_y}-{app_m:02d} 납부 처리 완료{old_str} ({(p.rent_amount or 0) + (p.maintenance_amount or 0):,}원, {p.paid_date})"}


@tool(write=True)
def cancel_payment(building: str, unit: int, month: int = 0, year: int = 0, note: str = "납부 취소") -> Dict[str, Any]:
    """납부 취소: 미납으로 되돌린다 (기본: 가장 최근 완납월에 취소 적용)."""
    u = Building.require(building).unit(unit)
    if month > 0:
        y = year or today().year
        u.cancel(month, y, note)
        c_y, c_m = y, month
    else:
        _, c_y, c_m = u.cancel_lifo(note=note)
    return {"message": f"↩️ {unit}호 {c_y}-{c_m:02d} (가장 최근월) 납부를 취소했습니다 ({note})."}


@tool(write=True)
def end_contract(building: str, unit: int, move_out: str = "") -> Dict[str, Any]:
    """퇴실 처리: 현재 계약을 종료하고 1년 보존 이력으로 남긴다 (기본 오늘)."""
    c = Building.require(building).unit(unit).active()
    if not c:
        raise LookupError(f"{unit}호는 현재 거주 중인 계약이 없습니다.")
    c.end(move_out)
    return {"message": f"🚪 {unit}호 {c.tenant_name}님 퇴실 처리 ({c.move_out}). 이력은 {c.retention_until}까지 보존됩니다."}


@tool(write=True)
def add_expense(building: str, item: str, amount: int, date: str = "", note: str = "") -> Dict[str, Any]:
    """지출 기록: 건물 운영·수리비 등을 장부에 추가한다."""
    e = Expense(building_id=Building.require(building).id, date=date or today().isoformat(), item=item, amount=amount, note=note).save()
    return {"expense": e.id, "message": f"🧾 지출 기록: {e.item} {e.amount:,}원 ({e.date})"}


@tool(write=True)
def update_contract(building: str, unit: int, expiry: str = "", move_in: str = "", rent: int = 0,
                    deposit: int = 0, maintenance: int = 0, phone: str = "", note: str = "") -> Dict[str, Any]:
    """계약 수정: 기존 거주 중인 임차인의 만기일, 임대료, 보증금, 연락처 등을 변경한다."""
    u = Building.require(building).unit(unit)
    c = u.active()
    if not c:
        raise LookupError(f"{unit}호는 현재 거주 중인 활성 계약이 없습니다.")
    form: Dict[str, Any] = {}
    if expiry:
        d = pdate(expiry)
        form["expiry"] = d.isoformat() if d else expiry
    if move_in:
        d = pdate(move_in)
        form["move_in"] = d.isoformat() if d else move_in
    if rent > 0:
        form["rent"] = rent
    if deposit > 0:
        form["deposit"] = deposit
    if maintenance > 0:
        form["maintenance"] = maintenance
    if phone:
        form["phone"] = phone
    if note:
        form["note"] = note
    updated = u.update(form)
    changes = []
    if expiry: changes.append(f"만기일: {updated.expiry}")
    if move_in: changes.append(f"입주일: {updated.move_in}")
    if rent > 0: changes.append(f"월세: {updated.rent:,}원")
    if deposit > 0: changes.append(f"보증금: {updated.deposit:,}원")
    return {"contract": updated.id, "message": f"✏️ {unit}호 {updated.tenant_name}님 계약 정보 수정 완료 ({', '.join(changes) or '반영완료'})"}


@tool(write=True)
def new_contract(building: str, unit: int, tenant_name: str, deposit: int, rent: int, maintenance: int = 0,
                 move_in: str = "", expiry: str = "", phone: str = "", lease_type: str = "월세", pay_timing: str = "후불") -> Dict[str, Any]:
    """신규 계약: 호실에 새 임차인 계약서를 만든다 (기존 거주 계약이 있으면 거절)."""
    u = Building.require(building).unit(unit)
    if u.active():
        raise ValueError(f"{unit}호는 이미 {u.active().tenant_name}님이 거주 중입니다. 먼저 퇴실 처리해 주세요.")
    c = u.update({"name": tenant_name, "deposit": deposit, "rent": rent, "maintenance": maintenance, "move_in": move_in or today().isoformat(),
                  "expiry": expiry, "phone": phone, "lease_type": lease_type, "pay_timing": pay_timing})
    return {"contract": c.id, "message": f"📑 {unit}호 {tenant_name}님 신규 계약 등록 ({c.move_in}~{c.expiry})"}


# ───────────── 오프라인 규칙 (API 키 없이도 동작 · 결정적 테스트용) ─────────────
def _args(msg: str, ctx: dict, **extra: Any) -> dict:
    t, a = today(), dict(ctx)
    if (m := re.search(r"(\d{3,4})\s*호?", msg)):
        a["unit"] = int(m.group(1))
    if (m := re.search(r"(\d{4})\s*년", msg)):
        a["year"] = int(m.group(1))
    if re.search(r"지난\s*달", msg):
        a["year"], a["month"] = (t.year, t.month - 1) if t.month > 1 else (t.year - 1, 12)
    elif (m := re.search(r"(\d{1,2})\s*월", msg)):
        a["month"] = int(m.group(1))
    for b in Building.all():
        if b.id in msg or any(n and n in msg for n in [*b.aliases, b.name.split()[0]]):
            a["building"] = b.id
    return {**a, **extra}


def _plan(tool_name: str, **extra: Any):
    def fn(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
        room_match = re.search(r"(\d{3,4})\s*호?", m.string)
        if room_match and tool_name in ("expiring_contracts", "unpaid"):
            return [("unit_card", _args(m.string, ctx, **extra))]
        return [(tool_name, _args(m.string, ctx, **extra))]
    return fn


def _modify_contract_rule(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    msg = m.string
    u_match = re.search(r"(\d{3,4})\s*호?", msg)
    if not u_match:
        return [("search", {"query": msg})]
    u_num = int(u_match.group(1))
    args: Dict[str, Any] = {"unit": u_num}
    d = pdate(msg)
    if d:
        if "입주" in msg or "전입" in msg or "시작" in msg:
            args["move_in"] = d.isoformat()
        else:
            args["expiry"] = d.isoformat()
    amt = re.search(r"(\d[\d,]*)\s*(만)?\s*원", msg)
    if amt:
        val = num(amt.group(1)) * (10000 if amt.group(2) else 1)
        if "보증금" in msg:
            args["deposit"] = val
        elif "월세" in msg or "임대료" in msg:
            args["rent"] = val
        elif "관리비" in msg:
            args["maintenance"] = val
    return [("update_contract", _args(msg, ctx, **args))]


def _expense(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    amt = re.search(r"(\d[\d,]*)\s*(만)?\s*원", m.string)
    if not amt:
        return [("search", {"query": m.string})]
    won = num(amt.group(1)) * (10000 if amt.group(2) else 1)
    item = re.sub(r"(\d[\d,]*\s*만?\s*원|지출|비용|추가|기록|등록|해\s*줘|해줘|[0-9]{3}\s*호)", " ", m.string).strip() or "기타 지출"
    return [("add_expense", _args(m.string, ctx, item=item, amount=won))]


def _vat(m: re.Match, ctx: dict) -> List[Tuple[str, dict]]:
    s, e = 1, 6
    if "하반기" in m.string:
        s, e = 7, 12
    elif (r := re.search(r"(\d{1,2})\s*[~\-]\s*(\d{1,2})\s*월", m.string)):
        s, e = int(r.group(1)), int(r.group(2))
    return [("vat_summary", _args(m.string, ctx, start_month=s, end_month=e))]


agent.OFFLINE_RULES[:] = [(re.compile(p, re.I), fn) for p, fn in [
    (r"수정|변경|바꿔|연장|\b(?:만기|입주).*(?:\d{4}[-./년\s]\d{1,2}|\d{8})", _modify_contract_rule),
    (r"납부\s*취소|수납\s*취소|입금\s*취소", _plan("cancel_payment")),
    (r"(납부|수납|입금|납입)\s*(처리|완료|했|확인)", _plan("record_payment")),
    (r"퇴실|전출|이사\s*나", _plan("end_contract")),
    (r"지출|\d\s*만?\s*원.*(교체|수리|구매|청소)", _expense),
    (r"미납|연체|안\s*낸", _plan("unpaid")),
    (r"만기|갱신|계약\s*종료|재계약", _plan("expiring_contracts")),
    (r"부가세|vat|세금계산", _vat),
    (r"공실|빈\s*방|빈방", _plan("vacancies")),
    (r"요약|현황|통계|브리핑", _plan("building_summary")),
    (r"이력|타임라인|최근\s*(변경|기록)|로그", _plan("timeline")),
    (r"\d{3}\s*호", _plan("unit_card")),
]]


OCR_PROMPT = ("이 이미지는 임대차계약서/입주신청서/장부 캡처입니다. 호실, 세입자, 보증금, 월세, 관리비, 전입일, 만기일, 연락처, 주민등록번호를 "
              "빠짐없이 추출해 JSON 배열로만 출력하세요(단건도 배열). 예: [{\"호실\":\"201\",\"세입자\":\"홍길동\",\"보증금\":\"5000000\",\"월세\":\"300000\","
              "\"관리비\":\"30000\",\"전입일\":\"2026-10-20\",\"만기일\":\"2027-10-20\",\"연락처\":\"010-1234-5678\"}]")


def read_contract_image(image_base64: str) -> Dict[str, Any]:
    """계약서·장부 사진에서 계약 후보 행을 추출한다 (키 없음/실패 시 사용자에게 직접 입력 안내)."""
    if not agent.api_key():
        return {"success": False, "has_api_key": False, "rows": [], "source": "no_api_key",
                "message": "서버에 GEMINI_API_KEY가 설정되어 있지 않아 이미지 AI 스캔이 제한됩니다. 직접 입력해 주세요."}
    head, _, body = image_base64.rpartition(",")
    mime = "image/jpeg" if "jpeg" in head or "jpg" in head else "image/webp" if "webp" in head else "image/png"
    try:
        parsed = agent.gemini_json(OCR_PROMPT, body, mime)
        rows = parsed if isinstance(parsed, list) else next((v for v in parsed.values() if isinstance(v, list) and v and isinstance(v[0], dict)), [parsed])
        return {"success": bool(rows), "rows": rows, "source": "gemini_vision"}
    except Exception as e:
        return {"success": False, "has_api_key": True, "rows": [], "source": "ocr_failed",
                "message": f"계약서 AI 분석 실패 ({e}). 사진이 흐리거나 일시적 API 지연입니다. 다시 촬영하거나 직접 입력해 주세요."}


RECEIPT_OCR_PROMPT = ("이 이미지는 영수증, 간이영수증, 세금계산서, 이체증, 신용카드 영수증 캡처입니다. "
                       "일자(YYYY-MM-DD), 지출품목(상호 또는 물품명), 지출금액(숫자만), 증빙유형(세금계산서/신용카드/현금영수증/간이영수증 중 하나), 적요를 "
                       "추출해 JSON 객체로 출력하세요. 예: {\"date\":\"2026-05-10\",\"item\":\"보일러 부품 교체\",\"amount\":75000,\"receipt_type\":\"신용카드\",\"note\":\"203호 난방 수리\"}")


def read_receipt_image(image_base64: str) -> Dict[str, Any]:
    """영수증 사진에서 지출 항목, 금액, 증빙유형을 추출한다."""
    if not agent.api_key():
        return {"success": False, "has_api_key": False, "data": None, "source": "no_api_key",
                "message": "서버에 GEMINI_API_KEY가 설정되어 있지 않아 영수증 AI 스캔이 제한됩니다. 직접 입력해 주세요."}
    head, _, body = image_base64.rpartition(",")
    mime = "image/jpeg" if "jpeg" in head or "jpg" in head else "image/webp" if "webp" in head else "image/png"
    try:
        parsed = agent.gemini_json(RECEIPT_OCR_PROMPT, body, mime)
        if isinstance(parsed, list) and parsed:
            parsed = parsed[0]
        return {"success": bool(parsed), "data": parsed, "source": "gemini_vision"}
    except Exception as e:
        return {"success": False, "has_api_key": True, "data": None, "source": "ocr_failed",
                "message": f"영수증 AI 분석 실패 ({e}). 다시 촬영하거나 직접 입력해 주세요."}


def system_prompt(user: Any) -> str:
    return (f"당신은 원룸 임차관리 AI 비서입니다. 건물·계약서·수납·지출 객체를 도구로 조회/변경합니다. 오늘은 {today().isoformat()}.\n"
            f"사용자: {user.summary()}. 한국어로 간결하게 답하고, 숫자는 도구 결과만 사용하세요(추측 금지).\n"
            "쓰기 도구는 사용자 확인 후 실행되므로 '확인 버튼을 눌러달라'고 안내하세요. 호실이 모호하면 먼저 search/unit_card로 확인하세요.")
