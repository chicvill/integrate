"""
domain/parser.py — 은행 입금 알림 문자 / 카카오뱅크 / 토스 / 계좌이체 텍스트 자동 파서.
스마트폰에서 복사한 입금 문자나 카톡 메시지를 분석해 (호실, 입금자명, 금액, 입금일자, 메모)를 추출한다.
"""
import re
from datetime import date
from typing import Any, Dict, List, Optional

from .rent import Building, num, pdate, today

# 은행 알림 문자 일반 패턴들
# 예1: [KB] 05/10 14:20 201호 홍길동 500,000원 입금 잔액 12,345,000
# 예2: [신한은행] 05/12 11:30 302호 450,000원 입금 (주)***
# 예3: 카카오뱅크 05/10 15:30 101호 김철수 400,000원 입금
# 예4: 201호 홍길동 50만원 5월 10일
# 예5: 304호 500,000 입금완료

_ROOM_RE = re.compile(r"(\d{3,4})\s*호?")
_MONEY_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d{4,9})\s*원?")
_MAN_WON_RE = re.compile(r"(\d+(?:\.\d+)?)\s*만\s*원?")
_DATE_MD_RE = re.compile(r"(\d{1,2})[./\s월]\s*(\d{1,2})[일]?")
_TIME_RE = re.compile(r"\b\d{1,2}:\d{2}\b")


def parse_bank_message(text: str, default_building: str = "main") -> Dict[str, Any]:
    """
    한 줄 또는 여러 줄의 입금 통지 문자를 파싱하여 수납 처리 가능한 딕셔너리로 변환한다.
    """
    clean = text.strip()
    if not clean:
        return {"success": False, "message": "입력된 문자 내용이 없습니다."}

    # 1. 호실 번호 추출
    room_match = _ROOM_RE.search(clean)
    room_number = int(room_match.group(1)) if room_match else 0

    # 2. 금액 추출 (만원 단위 우선, 그 다음 일반 숫자/콤마)
    amount = 0
    man_match = _MAN_WON_RE.search(clean)
    if man_match:
        amount = int(float(man_match.group(1)) * 10000)
    else:
        # 금액 후보들 중 날짜/시간/호실과 겹치지 않는 가장 큰 금액 탐색
        candidates = []
        for m in _MONEY_RE.finditer(clean):
            val = num(m.group(1))
            if val >= 10000:  # 1만원 이상
                candidates.append(val)
        if candidates:
            amount = candidates[0]

    # 3. 입금 일자 추출
    t = today()
    paid_date = t.isoformat()
    d_match = pdate(clean)
    if d_match:
        paid_date = d_match.isoformat()
    else:
        md_match = _DATE_MD_RE.search(clean)
        if md_match:
            try:
                m, d = int(md_match.group(1)), int(md_match.group(2))
                if 1 <= m <= 12 and 1 <= d <= 31:
                    paid_date = date(t.year, m, d).isoformat()
            except ValueError:
                pass

    # 4. 입금자명 후보 추출 (호실 뒤 또는 앞의 한글 이름 2~4글자)
    tenant_candidate = ""
    name_match = re.search(r"(?:호\s*|\b)([가-힣]{2,4})(?:\s*님|\s*\d|\s*입금|\s*원|$)", clean)
    if name_match:
        cand = name_match.group(1)
        if cand not in ("입금", "출금", "잔액", "이체", "타행", "당행", "은행", "체크", "승인", "완료", "월세", "관리비"):
            tenant_candidate = cand

    # 5. 건물 및 호실 객체 매칭 확인
    b = Building.resolve(default_building)
    matched_unit = None
    expected_rent = 0
    expected_maint = 0
    expected_tenant = ""

    if b and room_number:
        try:
            u = b.unit(room_number)
            c = u.active()
            matched_unit = u
            if c:
                expected_tenant = c.tenant_name
                expected_rent = c.monthly_rent
                expected_maint = c.maintenance
        except Exception:
            pass

    # 입금 대상 월 판정 (입금일의 월 기준)
    p_dt = pdate(paid_date) or t
    target_month = p_dt.month
    target_year = p_dt.year

    return {
        "success": bool(room_number > 0 and amount > 0),
        "raw_text": clean,
        "room_number": room_number,
        "amount": amount,
        "paid_date": paid_date,
        "target_year": target_year,
        "target_month": target_month,
        "detected_tenant": tenant_candidate,
        "expected_tenant": expected_tenant,
        "expected_total": expected_rent + expected_maint,
        "matched": bool(matched_unit is not None),
        "message": f"{room_number}호 {amount:,}원 ({p_dt.month}월분)" if (room_number and amount) else "호실 또는 금액을 파악하지 못했습니다."
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
