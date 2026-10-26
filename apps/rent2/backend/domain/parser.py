"""
domain/parser.py — 은행 입금 알림 문자 / 카카오뱅크 / 토스 / 계좌이체 텍스트 자동 파서.
스마트폰에서 복사한 입금 문자나 카톡 메시지를 분석해 (호실, 입금자명, 금액, 입금일자, 메모)를 추출한다.
"""
import re
from datetime import date
from typing import Any, Dict, List, Optional

from .rent import Building, Room, num, pdate, today

# 은행 알림 문자 일반 패턴 및 계좌번호/잔액/일시 필터링 정규식
_ACCOUNT_RE = re.compile(
    r"\b(?:\d{2,6}[-*]){1,4}[\d*]{2,8}\b|"
    r"\b\d{2,4}[-*]\d{2,4}[-*]\d{2,6}\b|"
    r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b|"
    r"\b\d{10,16}\b"
)
_BALANCE_RE = re.compile(r"잔[액고]\s*[:\s]*[\d,]+(?:\s*원)?")
_TIME_RE = re.compile(r"\b\d{1,2}:\d{2}(?::\d{2})?\b")
_DATE_YMD_RE = re.compile(r"\b(20\d{2})[-./년\s]\s*(\d{1,2})[-./월\s]\s*(\d{1,2})[일]?\b")
_DATE_MD_RE = re.compile(r"\b(\d{1,2})[-./월\s]\s*(\d{1,2})[일]?\b")

_ROOM_EXPLICIT_RE = re.compile(r"(\d{3,4})\s*호\b")
_ROOM_RE = re.compile(r"(\d{3,4})\s*호?")
_MAN_WON_RE = re.compile(r"(\d+(?:\.\d+)?)\s*만\s*원?")
_WON_MONEY_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원")
_DEPOSIT_MONEY_RE = re.compile(r"(?:입금|이체|수납|보냈습니다)\s*[:\s]*(\d{1,3}(?:,\d{3})+|\d{4,9})")
_MONEY_DEPOSIT_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d{4,9})\s*(?:입금|이체|수납)")


def parse_bank_message(text: str, default_building: str = "main") -> Dict[str, Any]:
    """
    한 줄 또는 여러 줄의 입금 통지 문자를 파싱하여 수납 처리 가능한 딕셔너리로 변환한다.
    - 계좌번호 내 숫자나 통장 잔액을 호실 번호로 오인하지 않도록 사전 필터링/마스킹 수행.
    - 호실 번호 명시가 없거나 계좌번호와 섞인 경우에도, 등록된 세입자(송금자) 이름으로 호실을 자동 추적.
    """
    clean = text.strip()
    if not clean:
        return {"success": False, "message": "입력된 문자 내용이 없습니다."}

    # 건물 및 등록된 호실/세입자 목록 사전 수집
    b = Building.resolve(default_building)
    valid_units: set[int] = set(b.units) if b else set()
    tenant_to_unit: Dict[str, int] = {}
    unit_to_tenant: Dict[int, str] = {}
    unit_to_expected: Dict[int, int] = {}
    unit_to_rent: Dict[int, int] = {}
    unit_to_maintenance: Dict[int, int] = {}
    past_tenant_to_unit: Dict[str, int] = {}

    if b and b.units:
        for u_num in b.units:
            try:
                u_obj = b.unit(u_num)
                c_act = u_obj.active()
                if c_act and c_act.tenant_name:
                    tname = c_act.tenant_name.strip()
                    tenant_to_unit[tname] = u_num
                    unit_to_tenant[u_num] = tname
                    r_val = c_act.monthly_rent or 0
                    m_val = c_act.maintenance or 0
                    unit_to_rent[u_num] = r_val
                    unit_to_maintenance[u_num] = m_val
                    unit_to_expected[u_num] = r_val + m_val
                else:
                    r_obj = Room.get_room(b.id, u_num)
                    if r_obj and r_obj.contract and r_obj.contract.get("name"):
                        tname = r_obj.contract.get("name").strip()
                        tenant_to_unit[tname] = u_num
                        unit_to_tenant[u_num] = tname
                        rent_v = num(r_obj.contract.get("rent")) or 0
                        maint_v = num(r_obj.contract.get("maintenance")) or 0
                        unit_to_rent[u_num] = rent_v
                        unit_to_maintenance[u_num] = maint_v
                        unit_to_expected[u_num] = rent_v + maint_v
                for h in u_obj.ended():
                    if h.tenant_name and h.tenant_name.strip() not in tenant_to_unit:
                        past_tenant_to_unit[h.tenant_name.strip()] = u_num
            except Exception:
                pass

    # A. 통장 잔액 마스킹 (잔액 숫자가 금액 또는 호실로 오인되는 것 원천 방지)
    working = _BALANCE_RE.sub(" ", clean)

    # B. 계좌번호 및 전화번호 마스킹 (계좌번호 내 3~4자리 숫자가 호실 또는 금액으로 오인되는 것 방지)
    working = _ACCOUNT_RE.sub(" ", working)

    # C. 시간 마스킹 (예: 14:20 -> 숫자가 날짜나 금액으로 오인되지 않게 치환)
    working = _TIME_RE.sub(" ", working)

    # D. 입금 일자 추출
    t = today()
    paid_date = t.isoformat()
    ymd_match = _DATE_YMD_RE.search(working)
    if ymd_match:
        try:
            y = int(ymd_match.group(1))
            m = int(ymd_match.group(2))
            d = int(ymd_match.group(3))
            paid_date = date(y, m, d).isoformat()
            working = working[:ymd_match.start()] + " " + working[ymd_match.end():]
        except Exception:
            pass
    else:
        md_match = _DATE_MD_RE.search(working)
        if md_match:
            try:
                m = int(md_match.group(1))
                d = int(md_match.group(2))
                if 1 <= m <= 12 and 1 <= d <= 31:
                    paid_date = date(t.year, m, d).isoformat()
                    working = working[:md_match.start()] + " " + working[md_match.end():]
            except Exception:
                pass

    p_dt = pdate(paid_date) or t
    target_month = p_dt.month
    target_year = p_dt.year

    # E. 금액 추출
    amount = 0
    man_match = _MAN_WON_RE.search(working)
    if man_match:
        amount = int(float(man_match.group(1)) * 10000)
        working = working[:man_match.start()] + " " + working[man_match.end():]
    else:
        won_m = _WON_MONEY_RE.search(working)
        if won_m:
            amount = num(won_m.group(1))
            working = working[:won_m.start()] + " " + working[won_m.end():]
        else:
            dep_m = _DEPOSIT_MONEY_RE.search(working) or _MONEY_DEPOSIT_RE.search(working)
            if dep_m:
                amount = num(dep_m.group(1))
                working = working[:dep_m.start()] + " " + working[dep_m.end():]
            else:
                # 콤마 포함 1만원 이상 숫자 탐색
                for cm in re.finditer(r"\b(\d{1,3}(?:,\d{3})+)\b", working):
                    val = num(cm.group(1))
                    if val >= 10000:
                        amount = val
                        working = working[:cm.start()] + " " + working[cm.end():]
                        break

    # F. 호실 및 세입자(송금자명) 매칭
    room_number = 0
    detected_tenant = ""

    # 1단계: 원본 문자열에서 등록된 세입자명(송금자 이름) 검색
    matched_by_tenant = False
    for tname, u_num in tenant_to_unit.items():
        if len(tname) >= 2 and tname in clean:
            room_number = u_num
            detected_tenant = tname
            matched_by_tenant = True
            break
    if not matched_by_tenant:
        for tname, u_num in past_tenant_to_unit.items():
            if len(tname) >= 2 and tname in clean:
                room_number = u_num
                detected_tenant = tname
                matched_by_tenant = True
                break

    # 2단계: 명시적 호실 번호 ('호' 포함) 탐색
    explicit_m = _ROOM_EXPLICIT_RE.search(clean)
    if explicit_m:
        exp_room = int(explicit_m.group(1))
        if not room_number or (valid_units and exp_room in valid_units):
            room_number = exp_room

    # 3단계: 호실 번호가 아직 없고 세입자명도 못 찾은 경우
    # 마스킹 완료된 working 텍스트에서 3~4자리 숫자 중 유효 호실에 해당하는 숫자 탐색
    if room_number == 0:
        for m in re.finditer(r"\b(\d{3,4})\b", working):
            cand = int(m.group(1))
            if valid_units and cand in valid_units:
                room_number = cand
                break
        if room_number == 0 and not valid_units:
            m = re.search(r"\b(\d{3,4})\b", working)
            if m:
                room_number = int(m.group(1))

    # 4단계: 입금자명 후보 추출 (세입자명 사전 매칭이 없었던 경우 문맥에서 추출)
    if not detected_tenant:
        name_match = re.search(r"(?:호\s*|\b)([가-힣]{2,4})(?:\s*님|\s*\d|\s*입금|\s*원|$)", working)
        if name_match:
            cand = name_match.group(1)
            if cand not in ("입금", "출금", "잔액", "이체", "타행", "당행", "은행", "체크", "승인", "완료", "월세", "관리비", "수납", "보냈습니다"):
                detected_tenant = cand
        if not detected_tenant and room_number in unit_to_tenant:
            detected_tenant = unit_to_tenant[room_number]

    # G. 계약 정보 매칭 및 금액 스마트 폴백
    expected_tenant = unit_to_tenant.get(room_number, "")
    expected_total = unit_to_expected.get(room_number, 0)
    matched_unit = None
    if b and room_number in valid_units:
        try:
            matched_unit = b.unit(room_number)
        except Exception:
            pass

    is_fallback = False
    if amount == 0 and expected_total > 0:
        amount = expected_total
        is_fallback = True
    elif amount == 0 and room_number > 0:
        short_num_m = re.search(r"\b(\d{2,3})\b", working)
        if short_num_m:
            short_val = int(short_num_m.group(1))
            if 10 <= short_val <= 900:
                amount = short_val * 10000

    success_flag = (room_number > 0 and amount > 0)
    msg = ""
    if success_flag:
        fallback_str = " (계약금액 자동적용)" if is_fallback else ""
        t_prefix = f"[{detected_tenant}] " if detected_tenant else ""
        msg = f"{t_prefix}{room_number}호 {amount:,}원{fallback_str} ({target_month}월분)"
    else:
        if room_number == 0:
            msg = "입금 문자에서 호실 번호(예: 403호) 또는 입금자명(세입자)을 찾지 못했습니다."
        else:
            msg = f"{room_number}호 입금 금액을 확인하지 못했습니다."

    expected_tenant = unit_to_tenant.get(room_number, "")
    expected_rent = unit_to_rent.get(room_number, 0)
    expected_maintenance = unit_to_maintenance.get(room_number, 0)
    expected_total = unit_to_expected.get(room_number, 0)
    is_mismatch = bool(amount > 0 and expected_total > 0 and amount != expected_total)
    diff = (amount - expected_total) if (amount > 0 and expected_total > 0) else 0

    return {
        "success": success_flag,
        "raw_text": clean,
        "room_number": room_number,
        "amount": amount,
        "is_fallback_amount": is_fallback,
        "paid_date": paid_date,
        "target_year": target_year,
        "target_month": target_month,
        "detected_tenant": detected_tenant,
        "expected_tenant": expected_tenant,
        "expected_rent": expected_rent,
        "expected_maintenance": expected_maintenance,
        "expected_total": expected_total,
        "amount_mismatch": is_mismatch,
        "diff": diff,
        "matched": matched_unit is not None or (room_number in valid_units),
        "message": msg
    }


def parse_batch_bank_messages(text: str, default_building: str = "main") -> List[Dict[str, Any]]:
    """여러 건의 알림 문자가 한 번에 복사된 경우 줄바꿈/구분자로 나누어 파싱"""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    results = []
    # 블록 단위로 묶거나 한 줄 단위로 분석
    for line in lines:
        if any(kw in line for kw in ("입금", "이체", "호", "원")):
            r = parse_bank_message(line, default_building)
            if r["success"]:
                results.append(r)
    if not results and text.strip():
        # 전체를 단일 메시지로 다시 시도
        r = parse_bank_message(text, default_building)
        if r["success"]:
            results.append(r)
    return results


def parse_contract_roster(text: str) -> List[Dict[str, Any]]:
    """
    임대차 계약 명부/장부 텍스트(한 줄 또는 여러 줄)를 파싱하여 호실 계약서 입력용 딕셔너리 목록으로 변환.
    예: 101호 고종훈 2026-05-24 보증금 200만 월세 25만 관리비 8만 후불 010-4281-6453 납부일 24일 키 1907
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    results = []

    for line in lines:
        # 1. 호실 번호 탐색 (필수)
        room_match = _ROOM_RE.search(line)
        if not room_match:
            continue
        room_num = int(room_match.group(1))

        # 2. 전입일자 탐색
        move_in = ""
        date_m = re.search(r"\b(20\d{2}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}[일]?)\b", line)
        if date_m:
            d_obj = pdate(date_m.group(1))
            if d_obj:
                move_in = d_obj.isoformat()

        # 3. 전화번호 탐색
        phone = ""
        phone_m = re.search(r"\b(01[016789]-?\d{3,4}-?\d{4})\b", line)
        if phone_m:
            phone = phone_m.group(1)

        # 4. 금액들 탐색 (보증금, 월세, 관리비)
        deposit = 0
        rent = 0
        maintenance = 0

        # 보증금
        dep_m = re.search(r"(?:보증금|보증|보)\s*[:=]?\s*(\d+(?:\.\d+)?\s*만?원?|\d{1,3}(?:,\d{3})+원?)", line)
        if dep_m:
            deposit = num(dep_m.group(1))

        # 월세
        rent_m = re.search(r"(?:월세|임대료|월)\s*[:=]?\s*(\d+(?:\.\d+)?\s*만?원?|\d{1,3}(?:,\d{3})+원?)", line)
        if rent_m:
            rent = num(rent_m.group(1))

        # 관리비
        maint_m = re.search(r"(?:관리비|관)\s*[:=]?\s*(\d+(?:\.\d+)?\s*만?원?|\d{1,3}(?:,\d{3})+원?)", line)
        if maint_m:
            maintenance = num(maint_m.group(1))

        # 5. 세입자 이름 탐색 (호실 바로 뒤 또는 줄 첫머리의 2~4글자 한글)
        tenant_name = ""
        # 호실 뒤의 첫 번째 한글 단어
        after_room = line[room_match.end():]
        name_tokens = after_room.split()
        for tok in name_tokens:
            tok_clean = re.sub(r"[^\w가-힣]", "", tok)
            if re.match(r"^[가-힣]{2,4}$", tok_clean) and tok_clean not in (
                "보증금", "월세", "관리비", "후불", "선불", "납부일", "입금", "퇴실", "공실", "계약", "키", "미수"
            ):
                tenant_name = tok_clean
                break

        # 6. 지불 타이밍
        pay_timing = "선불" if "선불" in line else "후불"
        id_number = ""
        expiry = ""

        # 만약 엑셀 복사-붙여넣기(Tab 구분) 형태인 경우 각 열 위치 기반 정밀 추출
        if "\t" in line:
            parts = [p.strip() for p in line.split("\t")]
            # parts[0]: 호실 (예: 204)
            # parts[1]: 세입자 성명 (예: 주예란)
            if len(parts) >= 2 and parts[1]:
                cand_name = re.sub(r"[^\w가-힣]", "", parts[1])
                if cand_name and cand_name not in ("공실", "입주자", "성명", "세입자"):
                    tenant_name = cand_name
            # parts[2]: 주민등록번호 (예: 770925-2189614)
            if len(parts) >= 3 and re.search(r"\d{6}[-\s]?\d{7}", parts[2]):
                id_number = parts[2]
            # parts[3]: 전화번호 (예: 010-8962-8148)
            if len(parts) >= 4 and not phone:
                ph_m = re.search(r"01[016789]-?\d{3,4}-?\d{4}", parts[3])
                if ph_m:
                    phone = ph_m.group(0)
            # parts[4]: 전입일 (예: 2021.6.5)
            if len(parts) >= 5 and not move_in:
                d_in = pdate(parts[4])
                if d_in:
                    move_in = d_in.isoformat()
            # parts[5]: 만기일 (예: 2022.6.4)
            if len(parts) >= 6:
                d_exp = pdate(parts[5])
                if d_exp:
                    expiry = d_exp.isoformat()
            # parts[7]: 선후 (예: 선불 / 후불)
            if len(parts) >= 8 and parts[7] in ("선불", "후불"):
                pay_timing = parts[7]
            # parts[8]: 보증금 (예: 5,000,000)
            if len(parts) >= 9:
                dep_val = num(parts[8])
                if dep_val > 0:
                    deposit = dep_val
            # 시크빌/일반 표준 엑셀: 10열=임대료(290,000), 11열=관리비(150,000)
            if len(parts) >= 12:
                r_val = num(parts[10])
                m_val = num(parts[11])
                if r_val > 0 and rent == 0:
                    rent = r_val
                if m_val > 0 and maintenance == 0:
                    maintenance = m_val

        # 7. 메모 (특이사항, 키 번호 등)
        notes = []
        for kw in ("납부일", "키", "미수", "동생", "부친", "모친", "자녀", "친구"):
            m = re.search(rf"({kw}\s*[:=]?\s*[^\s,]+(?:\s+[^\s,]+)?)", line)
            if m:
                notes.append(m.group(1))
        memo_str = " / ".join(notes) if notes else ""

        results.append({
            "room_number": room_num,
            "tenant_name": tenant_name,
            "id_number": id_number,
            "move_in": move_in,
            "expiry": expiry,
            "deposit": deposit,
            "rent": rent,
            "maintenance": maintenance,
            "pay_timing": pay_timing,
            "phone": phone,
            "clean_fee": 80000,
            "memo": {"note": memo_str} if memo_str else {}
        })

    return results

