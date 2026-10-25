"""
domain/rent.py — 임차관리 도메인 객체.

  Building(건물)  Contract(계약서)  Payment(수납 기록)  Expense(지출)  + Unit(호실, 저장하지 않는 '뷰')

핵심 설계: 월별 납부 상태는 '저장하는 표'가 아니라 계약서 객체가 규칙으로 '계산'한다.
(입주월 후불 익월 청구 / 전출 후 공실 / 선납 / 전세 0원 …) → 저장하는 것은 사실(실입금·취소)뿐.
"""
import re
from datetime import date, timedelta
from typing import Any, ClassVar, Dict, List, Optional, Tuple

from pydantic import Field

from ..kernel.base import Obj, store

# 과거·당월은 '정상 입금'으로 간주하는 기존 시스템의 운영 가정 (실제 미납은 취소 기록으로만 남는다)
ASSUME_PAID_THROUGH_NOW = True
ROOM_NUMBERS = [101, 201, 202, 203, 204, 205, 301, 302, 303, 304, 305, 401, 402, 403, 404, 405,
                501, 502, 503, 504, 505, 601, 602, 603, 604, 605, 701, 702, 703]
_DATE = re.compile(r"(\d{4})\s*[-./년\s]\s*(\d{1,2})\s*[-./월\s]\s*(\d{1,2})")


def today() -> date:
    import os
    v = os.getenv("RENT2_TODAY")
    return date.fromisoformat(v) if v else date.today()


def pdate(v: Any) -> Optional[date]:
    """'2025-6-4' · '2025. 6. 4' · '25.3.1' · '2025.03' · '20250604' 등 현실의 날짜 표기를 스스로 안전하게 해석"""
    s = str(v or "").strip()
    if not s:
        return None
    m = _DATE.search(s) or re.search(r"(\d{4})(\d{2})(\d{2})", s)
    if m:
        try:
            return date(*map(int, m.groups()))
        except ValueError:
            pass
    # 2자리 연도 YY.MM.DD (예: 25.03.01)
    m2 = re.search(r"(?:^|[^\d])(\d{2})[-./년\s]\s*(\d{1,2})[-./월\s]\s*(\d{1,2})", s)
    if m2:
        try:
            yy, mm, dd = map(int, m2.groups())
            return date(2000 + yy if yy < 100 else yy, mm, dd)
        except ValueError:
            pass
    # YYYY-MM (일자 생략 월 표기 -> 1일로 자가 보정)
    m_ym = re.search(r"(\d{4})[-./년\s]\s*(\d{1,2})", s)
    if m_ym:
        try:
            yy, mm = map(int, m_ym.groups())
            return date(yy, mm, 1)
        except ValueError:
            pass
    return None


def idx(y: int, m: int) -> int:
    return y * 12 + m


def _month(v: Any) -> Optional[int]:
    d = pdate(v)
    return idx(d.year, d.month) if d else None


def num(v: Any) -> int:
    if v is None:
        return 0
    s = str(v).replace(",", "").strip()
    if not s:
        return 0
    try:
        if "만" in s:
            m = re.search(r"(\d+(?:\.\d+)?)\s*만", s)
            if m:
                base = float(m.group(1)) * 10000
                rem = re.search(r"만\s*(\d+)", s)
                if rem:
                    base += float(rem.group(1))
                return int(base)
        m = re.search(r"-?\d+", s)
        return int(m.group(0)) if m else 0
    except (ValueError, TypeError):
        return 0


# ───────────────────────────── 계약서 ─────────────────────────────
class Contract(Obj):
    """한 임차인의 한 호실 계약. 종료되면 이력(전출자 1년 보존)이 되어 별도 테이블이 필요 없다."""
    scope_field = "building_id"
    building_id: str
    unit: int
    tenant_name: str = ""
    id_number: str = ""
    phone: str = ""
    lease_type: str = "월세"          # 월세 / 전세
    pay_timing: str = "후불"          # 선불 / 후불
    vat_target: bool = True         # 부가세 산출 대상 실 (체크 시 과세, 미체크 시 면세/제외)
    vat_separate: bool = False      # 부가세 별도 수납 여부 (체크 시 별도+세금영수증, 미체크 시 월세포함)
    vat_included: bool = True       # 기존 호환 (not vat_separate)
    deposit: int = 0
    rent: int = 0
    maintenance: int = 0
    clean_fee: int = 0
    move_in: str = ""
    expiry: str = ""
    move_out: str = ""
    memo: Dict[str, Any] = Field(default_factory=dict)

    @property
    def active(self) -> bool:
        return not self.move_out

    @property
    def monthly_rent(self) -> int:
        return 0 if self.lease_type == "전세" else self.rent

    @property
    def retention_until(self) -> str:
        d = pdate(self.move_out)
        return (d + timedelta(days=365)).isoformat() if d else ""

    def covers(self, i: int) -> bool:
        a, b = pdate(self.move_in), pdate(self.move_out)
        return (not a or i >= idx(a.year, a.month)) and (not b or i <= idx(b.year, b.month))

    def end(self, when: str = "") -> "Contract":
        self.move_out = when or today().isoformat()
        return self.save("ended")

    def days_left(self) -> Optional[int]:
        e = pdate(self.expiry)
        return (e - today()).days + 1 if e else None

    def renew_if_lapsed(self) -> bool:
        """만기가 지났는데 퇴실하지 않았으면 1년씩 자동 연장 (주택임대차 묵시적 갱신)"""
        e = pdate(self.expiry)
        if not (self.active and self.tenant_name and e and e < today()):
            return False
        while e < today():
            try:
                e = e.replace(year=e.year + 1)
            except ValueError:
                e += timedelta(days=365)
        self.expiry = e.isoformat()
        self.save("auto_renewed")
        return True

    def history_row(self) -> Dict[str, Any]:
        return {"id": self.id, "branch_id": self.building_id, "room_number": self.unit, "name": self.tenant_name,
                "id_number": self.id_number, "phone": self.phone, "lease_type": self.lease_type,
                "pay_timing": self.pay_timing, "vat_target": self.vat_target, "vat_separate": self.vat_separate,
                "vat_included": self.vat_included, "deposit": self.deposit, "rent": self.rent,
                "maintenance": self.maintenance, "clean_fee": self.clean_fee, "move_in": self.move_in,
                "expiry": self.expiry, "move_out": self.move_out, "retention_until": self.retention_until,
                "metadata_json": self.memo}

    def summary(self) -> str:
        state = "거주중" if self.active else f"퇴실 {self.move_out}"
        vat_str = "VAT제외(면세)" if not self.vat_target else ("VAT별도" if self.vat_separate else "VAT포함")
        return (f"{self.unit}호 {self.tenant_name or '(공실)'} · {self.lease_type}({vat_str}) 보증금 {self.deposit:,} / 월세 {self.rent:,}"
                f" + 관리비 {self.maintenance:,} · {self.move_in}~{self.expiry} · {state}")


class Payment(Obj):
    """수납 '사실' 기록 (실입금·취소·공실 표기). 기록이 없는 달은 계약서 규칙으로 계산된다."""
    scope_field = "building_id"
    building_id: str
    unit: int
    year: int
    month: int
    paid: bool = False
    paid_date: str = ""
    rent_amount: Optional[int] = None         # None = 계약 현재 금액을 따라감 (계약 변경 시 미납 예정액 자동 동기화)
    maintenance_amount: Optional[int] = None
    note: str = ""
    tenant_name: str = ""
    tenant_id_number: str = ""

    @staticmethod
    def pid(bid: str, unit: int, y: int, m: int) -> str:
        return f"{bid}:{unit}:{y}-{m:02d}"      # 결정적 ID → 중복 레코드가 구조적으로 불가능

    def summary(self) -> str:
        return f"{self.unit}호 {self.year}-{self.month:02d} {'납부 ' + self.paid_date if self.paid else '미납/취소'} {self.tenant_name} {self.note}"


class Expense(Obj):
    scope_field = "building_id"
    building_id: str
    date: str
    item: str
    amount: int = 0
    note: str = ""
    receipt_type: str = ""
    receipt_info: str = ""

    def summary(self) -> str:
        return f"지출 {self.date} {self.item} {self.amount:,}원 {self.note}"


# ───────────────────────────── 호실 (뷰) ─────────────────────────────
FORM = {"name": "tenant_name", "id_number": "id_number", "phone": "phone", "lease_type": "lease_type",
        "pay_timing": "pay_timing", "vat_target": "vat_target", "vat_separate": "vat_separate", "vat_included": "vat_included",
        "deposit": "deposit", "rent": "rent", "maintenance": "maintenance",
        "clean_fee": "clean_fee", "move_in": "move_in", "expiry": "expiry", "move_out": "move_out"}
MONEY = {"deposit", "rent", "maintenance", "clean_fee"}


class Unit:
    """호실 = 건물 안의 번호 + 그 호실의 계약서들 + 수납 기록. 저장하지 않고 필요할 때 조립한다."""

    def __init__(self, b: "Building", number: int, contracts: Optional[List[Contract]] = None,
                 pays: Optional[Dict[Tuple[int, int], Payment]] = None):
        self.b, self.number = b, number
        cs = contracts if contracts is not None else Contract.find(b.id, unit=number)
        self.contracts = sorted(cs, key=lambda c: (pdate(c.move_in) or date.min, pdate(c.move_out) or date.max))
        self.pays = pays if pays is not None else {(p.year, p.month): p for p in Payment.find(b.id, unit=number)}

    def active(self) -> Optional[Contract]:
        return next((c for c in reversed(self.contracts) if c.active), None)

    def latest(self) -> Optional[Contract]:
        return self.active() or (self.contracts[-1] if self.contracts else None)

    def ended(self) -> List[Contract]:
        return sorted((c for c in self.contracts if not c.active), key=lambda c: c.move_out, reverse=True)

    def covering(self, i: int) -> Optional[Contract]:
        cands = [c for c in self.contracts if c.covers(i)]
        leaving = [c for c in cands if not c.active and _month(c.move_out) == i]
        return (leaving or cands or [None])[-1]     # 전출월은 전출자가 납부, 그 외는 최신 계약

    def pay_day(self) -> int:
        c = self.latest()
        m = re.search(r"납부일:\s*(\d+)일", str(c.memo if c else "")) or re.search(r"(\d+)일", str(c.memo if c else ""))
        return min(int(m.group(1)), 28) if m else 25

    # ── 핵심 규칙: (연, 월) → 그 달의 임차 상태 ──
    def period(self, y: int, m: int) -> Dict[str, Any]:
        now, i = today(), idx(y, m)
        now_idx = idx(now.year, now.month)
        is_future = i > now_idx
        c, p = self.covering(i), self.pays.get((y, m))
        past = i <= now_idx if ASSUME_PAID_THROUGH_NOW else i < now_idx
        d: Dict[str, Any] = dict(year=y, month=m, tenant_name="공실", tenant_id_number="", is_previous_tenant=False,
                                 paid=False, paid_date="", rent_amount=0, maintenance_amount=0, note="공실", contract_id=None,
                                 is_future=is_future, vacancy=True)
        if c:
            first = _month(c.move_in) == i
            is_postpay = getattr(c, "pay_timing", "후불") == "후불"
            # [비즈니스 규칙] 전입월이고 계약서가 후불이면 실입금(완납)이 아닌 한 공실 처리 (익월 청구/당월 비과세)
            # 선불이면 미납 처리 (전입월 당일 납부 의무 발생/과세 대상)
            is_postpay_vacant = first and is_postpay and not (p and p.paid)

            if not c.active:
                paid, note = past, "이전 세입자 정상 입금 (전출)" if past else ""
            elif first:
                if is_postpay_vacant:
                    paid, note = False, "전입월 (후불 공실)"
                else:
                    paid, note = (p.paid if p else (c.pay_timing != "후불" and past)), ("입주월 완납" if (p and p.paid) else "입주월 선납 미납")
            elif is_future:
                paid, note = False, "청구 예정 (미도래)"
            else:
                paid, note = past, "정상 입금" if past else ""

            if is_postpay_vacant:
                d.update(tenant_name="공실", tenant_id_number="", is_previous_tenant=False,
                         paid=False, paid_date="", rent_amount=0, maintenance_amount=0,
                         note="전입월(후불 공실)", contract_id=c.id, vacancy=True)
            else:
                d.update(tenant_name=c.tenant_name, tenant_id_number=c.id_number, is_previous_tenant=not c.active,
                         paid=paid, paid_date=f"{y}-{m:02d}-10" if paid else "", rent_amount=c.monthly_rent,
                         maintenance_amount=c.maintenance, note=note, contract_id=c.id, vacancy=False)
                if p:   # 유효한 계약 기간 중 실제 수납 기록이 있으면 반영
                    d.update(paid=p.paid, paid_date=p.paid_date, note=p.note,
                             tenant_name=p.tenant_name or d["tenant_name"], tenant_id_number=p.tenant_id_number or d["tenant_id_number"])
                    if p.rent_amount is not None:
                        d["rent_amount"] = p.rent_amount
                    if p.maintenance_amount is not None:
                        d["maintenance_amount"] = p.maintenance_amount
        else:
            # [비즈니스 규칙] 이전 세입자 전출일 ~ 현 세입자 입주일 사이 (계약 없는 기간):
            # 과거 잔존 Payment 기록이 있더라도 무조건 "공실"로 확정!
            # 공실은 부가세 면제 대상이며 임차료/관리비는 0원 처리.
            d.update(tenant_name="공실", tenant_id_number="", is_previous_tenant=False,
                     paid=False, paid_date="", rent_amount=0, maintenance_amount=0,
                     note="공실", contract_id=None, vacancy=True)
        return d

    # ── [비즈니스 규칙 1] 호실별 미납 현황 판정 범위 ──
    # 입주월 이후 (후불인 경우 입주월 + 1)부터 전출월(정해진 경우) 또는 현재월(미정 시)까지로 한정
    def billable_bounds(self) -> Tuple[Optional[int], Optional[int]]:
        """
        유효 청구 및 미납 판정 범위 (start_idx, end_idx).
        - 시작월: 입주월 이후 (후불이면 입주월 + 1, 선불이면 입주월)
        - 종료월: 전출월이 정해지지 않았다면 현재월까지로 엄격히 한정!
                 전출월이 이미 정해졌다면 전출월까지 (단, 미래 날짜인 경우 현재월을 넘지 않음)
        """
        c = self.latest()
        if not c or not c.move_in:
            return (None, None)
        in_idx = _month(c.move_in)
        if in_idx is None:
            return (None, None)

        start_idx = (in_idx + 1) if getattr(c, "pay_timing", "후불") == "후불" else in_idx
        now = today()
        now_idx = idx(now.year, now.month)

        # 전출월(move_out) 지정 여부 검사
        move_out_str = (getattr(c, "move_out", "") or "").strip()
        if move_out_str:
            out_idx = _month(move_out_str)
            # 전출월이 정해진 경우: 전출월까지 한정 (단, 미래 날짜이면 현재월까지만 판정)
            end_idx = min(out_idx, now_idx) if out_idx is not None else now_idx
        else:
            # 전출월이 정해지지 않은 경우: 현재월까지로 엄격히 한정
            end_idx = now_idx

        if start_idx > end_idx:
            return (None, None)
        return (start_idx, end_idx)

    def is_billable_period(self, y: int, m: int) -> bool:
        """주어진 (연, 월)이 미납 판정 대상 범위에 포함되는지 확인"""
        s_idx, e_idx = self.billable_bounds()
        if s_idx is None or e_idx is None:
            return False
        return s_idx <= idx(y, m) <= e_idx

    def unpaid_periods(self) -> List[Tuple[int, int]]:
        """
        미납월 목록을 가장 오래된 순(오름차순, FIFO 적용 대상)으로 반환.
        범위: 입주월 이후(후불 입주월+1) ~ 전출월/당월
        """
        s_idx, e_idx = self.billable_bounds()
        if s_idx is None or e_idx is None:
            return []

        res: List[Tuple[int, int]] = []
        for i in range(s_idx, e_idx + 1):
            y, m = i // 12, i % 12
            if m == 0:
                y -= 1
                m = 12
            info = self.period(y, m)
            # 공실이 아니며, 미납(paid=False)이고, 청구액이 0보다 큰 경우만 미납
            if not info.get("vacancy") and not info.get("paid"):
                amt = (info.get("rent_amount") or 0) + (info.get("maintenance_amount") or 0)
                if amt > 0:
                    res.append((y, m))
        return sorted(res, key=lambda ym: idx(ym[0], ym[1]))

    def paid_periods(self) -> List[Tuple[int, int]]:
        """
        완납월 목록을 가장 최근 순(내림차순, LIFO 취소 대상)으로 반환.
        """
        s_idx, e_idx = self.billable_bounds()
        now = today()
        now_idx = idx(now.year, now.month)
        s_limit = s_idx if s_idx is not None else idx(now.year - 1, 1)
        e_limit = max(e_idx or now_idx, now_idx)

        # pays 기록 및 범위 내 월들을 검사
        candidates = set(range(s_limit, e_limit + 1))
        for (py, pm) in self.pays.keys():
            candidates.add(idx(py, pm))

        res: List[Tuple[int, int]] = []
        for i in sorted(candidates, reverse=True):
            y, m = i // 12, i % 12
            if m == 0:
                y -= 1
                m = 12
            info = self.period(y, m)
            if info.get("paid") and not info.get("vacancy"):
                res.append((y, m))
        return sorted(res, key=lambda ym: idx(ym[0], ym[1]), reverse=True)

    # ── 행동 ──
    def pay(self, month: int, year: Optional[int] = None, paid_date: Optional[str] = None, note: str = "정상 입금",
            tenant_name: Optional[str] = None, rent_amount: Optional[int] = None,
            maintenance_amount: Optional[int] = None) -> Payment:
        y = year or today().year
        base = self.period(y, month)
        p = Payment(id=Payment.pid(self.b.id, self.number, y, month), building_id=self.b.id, unit=self.number,
                    year=y, month=month, paid=True, paid_date=paid_date or today().isoformat(), note=note or "정상 입금",
                    tenant_name=tenant_name or base["tenant_name"], tenant_id_number=base["tenant_id_number"],
                    rent_amount=base["rent_amount"] if rent_amount is None else rent_amount,
                    maintenance_amount=base["maintenance_amount"] if maintenance_amount is None else maintenance_amount)
        self.pays[(y, month)] = p.save("paid", unit=self.number, period=f"{y}-{month:02d}", amount=(p.rent_amount or 0) + (p.maintenance_amount or 0))
        return p

    # ── [비즈니스 규칙 2] 입금 적용: 미납월 중 가장 오래된 월부터 우선 적용 (FIFO) ──
    def pay_fifo(self, paid_date: Optional[str] = None, note: str = "정상 입금",
                 tenant_name: Optional[str] = None, rent_amount: Optional[int] = None,
                 maintenance_amount: Optional[int] = None, fallback_month: int = 0,
                 fallback_year: int = 0) -> Tuple[Payment, int, int, bool]:
        """
        입금 적용월: 호실의 미납월 중 가장 오래된 것부터 우선 충당 (FIFO).
        미납월이 없으면 전달받은 fallback_month(또는 당월)에 적용.
        반환값: (Payment객체, 적용연도, 적용월, 과거미납충당여부)
        """
        unpaids = self.unpaid_periods()
        now = today()
        if unpaids:
            target_y, target_m = unpaids[0]  # 가장 오래된 미납월
            was_oldest = True
        else:
            target_y = fallback_year or now.year
            target_m = fallback_month or now.month
            was_oldest = False

        applied_note = note or "정상 입금"
        if was_oldest and f"{target_m}월" not in applied_note:
            applied_note = f"{applied_note} ({target_m}월 미납분 충당)"

        p = self.pay(month=target_m, year=target_y, paid_date=paid_date, note=applied_note,
                     tenant_name=tenant_name, rent_amount=rent_amount, maintenance_amount=maintenance_amount)
        return (p, target_y, target_m, was_oldest)

    def cancel(self, month: int, year: Optional[int] = None, note: Optional[str] = "납부 취소") -> Payment:
        y, note = year or today().year, note or "납부 취소"
        vacant = "공실" in note
        p = Payment(id=Payment.pid(self.b.id, self.number, y, month), building_id=self.b.id, unit=self.number,
                    year=y, month=month, paid=False, note=note, tenant_name="공실" if vacant else "",
                    rent_amount=0 if vacant else None, maintenance_amount=0 if vacant else None)
        self.pays[(y, month)] = p.save("cancelled", unit=self.number, period=f"{y}-{month:02d}", note=note)
        return p

    # ── [비즈니스 규칙 3] 취소 적용: 완납월 중 가장 최근월에 우선 적용 (LIFO) ──
    def cancel_lifo(self, note: Optional[str] = "납부 취소", fallback_month: int = 0,
                    fallback_year: int = 0) -> Tuple[Payment, int, int]:
        """
        취소 적용월: 호실의 완납월 중 가장 최근월부터 우선 취소 (LIFO).
        완납월이 없으면 전달받은 fallback_month(또는 당월) 취소.
        반환값: (Payment객체, 취소연도, 취소월)
        """
        paids = self.paid_periods()
        now = today()
        if paids:
            target_y, target_m = paids[0]  # 가장 최근 완납월
        else:
            target_y = fallback_year or now.year
            target_m = fallback_month or now.month

        applied_note = note or "납부 취소"
        p = self.cancel(month=target_m, year=target_y, note=applied_note)
        return (p, target_y, target_m)

    def reset_ledger(self) -> int:
        self.pays.clear()
        return Payment.purge(self.b.id, unit=self.number)

    def update(self, form: Dict[str, Any]) -> Optional[Contract]:
        """계약 입력 폼 반영: 신규 입주 / 정보 수정 / 퇴실(이력 자동 보존)을 하나의 규칙으로 처리"""
        cur = self.latest()
        name = (form["name"] if "name" in form else (cur.tenant_name if cur else "")) or ""
        out = form.get("move_out") or ""
        fresh = cur is None or (not cur.active and bool(name) and not out and name != cur.tenant_name)
        if cur is None and not name and not out:
            return None
        c: Contract
        if fresh or cur is None:
            c = Contract(building_id=self.b.id, unit=self.number)
            fresh = True
        else:
            c = cur
        leaving = bool(out) or bool(c.tenant_name and not name)
        for k, attr in FORM.items():
            v = form.get(k)
            if v is None or (k == "name" and not v) or (k == "id_number" and not v and c.id_number):
                continue            # 이름 비움=퇴실(이름은 이력으로 보존) · 주민번호 공란 제출 시 기존 값 보호
            if attr in ("vat_target", "vat_separate", "vat_included"):
                val = True if v in (True, "true", "True", "1", 1, "포함") else False
                setattr(c, attr, val)
                if attr == "vat_separate":
                    c.vat_included = not val
            else:
                setattr(c, attr, num(v) if k in MONEY else str(v).strip())
        if form.get("move_out") is not None:
            c.move_out = (form.get("move_out") or "").strip()
        elif leaving and c.tenant_name:
            c.move_out = out or today().isoformat()
        if form.get("note"):
            c.memo = {**c.memo, "note": form["note"]}
        self.b.add_unit(self.number)
        c.save("moved_out" if leaving else ("moved_in" if fresh else "updated"), unit=self.number, tenant=c.tenant_name)
        self.contracts = sorted({x.id: x for x in [*self.contracts, c]}.values(), key=lambda x: (pdate(x.move_in) or date.min, pdate(x.move_out) or date.max))
        return c

    def room(self, year: Optional[int] = None) -> Dict[str, Any]:
        """기존 화면/API가 기대하는 '호실 카드' 모양(레거시 호환)으로 직렬화"""
        c = self.latest()
        renewed = bool(c and c.renew_if_lapsed())
        f = c or Contract(building_id=self.b.id, unit=self.number)
        now, pay = today(), {}
        window = {(y, mm) for y in {now.year - 1, now.year, year or now.year} for mm in range(1, 13)} | set(self.pays)
        for py, pm in sorted(window):
            r = self.period(py, pm)
            row = {k: r[k] for k in ("paid", "paid_date", "rent_amount", "maintenance_amount", "note", "tenant_name")}
            row.update(month=pm, year=py, is_previous_tenant=r["is_previous_tenant"], vacancy=r.get("vacancy", False))
            pay[f"{py}-{pm}"] = row
            if year is None or py == year:
                pay[pm] = row
        unpaid_list = [f"{y}-{m:02d}" for (y, m) in self.unpaid_periods()]
        return {"room_number": self.number, "branch_id": self.b.id, "name": f.tenant_name, "id_number": f.id_number,
                "phone": f.phone, "lease_type": f.lease_type, "pay_timing": f.pay_timing,
                "vat_target": getattr(f, "vat_target", True), "vat_separate": getattr(f, "vat_separate", False),
                "vat_included": getattr(f, "vat_included", True),
                "deposit": f.deposit, "rent": f.rent, "maintenance": f.maintenance, "clean_fee": f.clean_fee, "move_in": f.move_in,
                "expiry": f.expiry, "auto_renewed": renewed, "move_out": f.move_out, "payments": pay,
                "unpaid_months": unpaid_list, "tenant_histories": [h.history_row() for h in self.ended()]}

    def card(self) -> Dict[str, Any]:
        """AI/사람이 한눈에 보는 호실 요약"""
        c, now = self.latest(), today()
        cur = self.period(now.year, now.month)
        unpaid = [f"{y}-{m:02d}" for (y, m) in self.unpaid_periods()]
        return {"building": self.b.name, "unit": self.number, "vacant": not self.active(),
                "contract": c.summary() if c else "계약 없음", "this_month": {"paid": cur["paid"], "note": cur["note"]},
                "unpaid_months": unpaid, "history": [h.summary() for h in self.ended()]}


# ───────────────────────────── 건물 ─────────────────────────────
class Building(Obj):
    scope_field = "id"
    name: str = ""
    address: str = ""
    contact_phone: str = ""
    fee_plan: str = "원룸 프리미엄 29실형"
    monthly_fee: int = 150000
    billing_status: str = "PAID"
    billing_due_day: int = 25
    last_paid_at: Optional[str] = None
    is_active: bool = True
    units: List[int] = Field(default_factory=list)
    aliases: List[str] = Field(default_factory=list)       # 별칭(chicvill01, 시크빌 …) → 단일 진입점 resolve()
    vat_target_rooms: Optional[List[int]] = None

    _cache: ClassVar[Dict[str, "Building"]] = {}
    _cache_time: ClassVar[float] = 0.0
    _CACHE_TTL: ClassVar[float] = 3.0  # 3초 인메모리 캐시 (초고속 응답 & 실시간 반영)

    @classmethod
    def invalidate_cache(cls) -> None:
        cls._cache.clear()
        cls._cache_time = 0.0

    @classmethod
    def cached_all(cls) -> List["Building"]:
        import time
        now = time.time()
        if not cls._cache or (now - cls._cache_time) > cls._CACHE_TTL:
            all_b = cls.all()
            cls._cache = {b.id: b for b in all_b}
            cls._cache_time = now
        return list(cls._cache.values())

    @classmethod
    def resolve(cls, ref: Optional[str], default_to_first: bool = False) -> Optional["Building"]:
        ref = (ref or "").strip()
        all_b = cls.cached_all()
        if not ref:
            return all_b[0] if (default_to_first and all_b) else None
        if ref in cls._cache:
            return cls._cache[ref]
        low = ref.lower()
        matched = next((b for b in all_b if low in (b.id.lower(), b.name.lower()) or low in {a.lower() for a in b.aliases}), None)
        if matched:
            return matched
        return all_b[0] if (default_to_first and all_b) else None

    @classmethod
    def canon(cls, ref: Optional[str]) -> str:
        b = cls.resolve(ref, default_to_first=True)
        return b.id if b else (ref or "main")

    @classmethod
    def require(cls, ref: Optional[str]) -> "Building":
        b = cls.resolve(ref, default_to_first=False)
        if not b:
            raise LookupError(f"해당 건물을 찾을 수 없습니다: {ref}")
        return b

    def save(self, action: str = "saved", **kwargs: Any) -> "Building":
        res = super().save(action, **kwargs)
        Building.invalidate_cache()
        return res

    def delete(self, action: str = "deleted", **kwargs: Any) -> None:
        super().delete(action, **kwargs)
        Building.invalidate_cache()

    def add_unit(self, n: int) -> None:
        if n not in self.units:
            self.units = sorted([*self.units, n])
            self.save("unit_added", unit=n)

    def unit(self, n: int) -> Unit:
        return Unit(self, n)

    def view(self) -> List[Unit]:
        cs: Dict[int, List[Contract]] = {}
        ps: Dict[int, Dict[Tuple[int, int], Payment]] = {}
        for c in Contract.find(self.id):
            cs.setdefault(c.unit, []).append(c)
        for p in Payment.find(self.id):
            ps.setdefault(p.unit, {})[(p.year, p.month)] = p
        return [Unit(self, n, cs.get(n, []), ps.get(n, {})) for n in sorted(set(self.units) | set(cs))]

    def rooms(self, year: Optional[int] = None) -> Dict[int, Dict[str, Any]]:
        return {u.number: u.room(year) for u in self.view()}

    def histories(self, unit: Optional[int] = None) -> List[Contract]:
        """전출 후 1년이 지난 이력은 열람 시 자동 파기 (개인정보 보존기한)"""
        for c in Contract.find(self.id):
            if not c.active and c.retention_until < today().isoformat():
                c.delete("purged")
        return sorted((c for c in Contract.find(self.id) if not c.active and (unit is None or c.unit == unit)),
                      key=lambda c: c.move_out, reverse=True)

    def expenses(self) -> List[Expense]:
        return sorted(Expense.find(self.id), key=lambda e: e.date, reverse=True)

    def update(self, data: Dict[str, Any]) -> "Building":
        for k in ("name", "contact_phone", "address", "is_active", "billing_status", "last_paid_at", "monthly_fee", "billing_due_day", "fee_plan"):
            if data.get(k) is not None:
                setattr(self, k, data[k])
        return self.save("updated")

    def wipe(self, rooms: bool = True) -> None:
        """장부·지출·이력 삭제 (rooms=True면 계약서까지 → 모든 호실 공실)"""
        for kind in (Payment, Expense, Contract) if rooms else (Payment, Expense):
            kind.purge(self.id)

    def destroy(self) -> None:
        self.wipe()
        self.delete()

    def summary(self) -> str:
        return f"건물 {self.name}({self.id}) {len(self.units)}호실 {self.address}"

    # ── 집계 · 조회 ──
    def stats(self) -> Dict[str, int]:
        us = self.view()
        return {"total_rooms": len(us), "vacant_rooms": sum(1 for u in us if not ((a := u.active()) and a.tenant_name))}

    def expiring(self, days: int = 65) -> List[Dict[str, Any]]:
        out = []
        for u in self.view():
            c = u.active()
            if c and c.tenant_name:
                c.renew_if_lapsed()
                left = c.days_left()
                if left is not None and 0 <= left <= days:
                    out.append({"room_number": u.number, "branch_id": self.id, "name": c.tenant_name, "phone": c.phone,
                                "expiry": c.expiry, "diff_days": left, "deposit": c.deposit, "rent": c.rent,
                                "maintenance": c.maintenance,
                                "period_category": "3일 전" if left <= 3 else "1개월 전" if left <= 35 else "3개월 전"})
        return sorted(out, key=lambda r: r["diff_days"])

    def unpaid(self, year: int, month: int) -> List[Dict[str, Any]]:
        out = []
        for u in self.view():
            if not u.is_billable_period(year, month):
                continue
            p = u.period(year, month)
            if not p["paid"] and not p["vacancy"]:
                amt = p["rent_amount"] + p["maintenance_amount"]
                if amt > 0:
                    out.append({"unit": u.number, "tenant": p["tenant_name"], "amount": amt, "note": p["note"]})
        return out

    # ── 대량 작업 ──
    def collect(self, year: Optional[int] = None, start: int = 1, end: int = 10, mode: str = "contract",
                specific_date: Optional[str] = None, note: str = "정상 입금 (일괄 수납)", include_unoccupied: bool = False) -> Dict[str, Any]:
        y = year or today().year
        a, z = sorted((max(1, min(12, start)), max(1, min(12, end))))
        count = total = 0
        units = self.view()
        with store().tx():
            for u in units:
                for m in range(a, z + 1):
                    if u.period(y, m)["vacancy"] and not include_unoccupied:
                        continue
                    when = specific_date if (mode == "specific" and specific_date) else f"{y}-{m:02d}-{u.pay_day():02d}"
                    p = u.pay(m, y, when, note)
                    count, total = count + 1, total + (p.rent_amount or 0) + (p.maintenance_amount or 0)
        msg = f"[{self.name}] {len(units)}개실의 {y}년 {a}월~{z}월 총 {count}건({total:,}원) 일괄 납입 처리가 완료되었습니다." if units else f"'{self.name}' 건물에 등록된 호실이 없습니다."
        return {"success": bool(units), "branch_id": self.id, "branch_name": self.name, "year": y, "start_month": a,
                "end_month": z, "total_rooms": len(units), "updated_count": count, "total_amount": total, "message": msg}

    def import_rooms(self, rows: List[Dict[str, Any]], clear: bool = True) -> Dict[str, Any]:
        with store().tx():
            if clear:
                Payment.purge(self.id)
                Contract.purge(self.id)
                self.units = []
                self.save("rooms_cleared")
            added = changed = 0
            for r in rows:
                n = num(r.get("room_number"))
                if not n:
                    continue
                u = self.unit(n)
                known = u.latest() is not None
                form = {k: v for k, v in r.items() if k in FORM and v is not None}
                if known and not str(form.get("name") or "").strip():
                    form.pop("name", None)
                u.update({**form, "note": r.get("note") or ""})
                self.add_unit(n)
                added, changed = (added, changed + 1) if known else (added + 1, changed)
        return {"success": True, "branch_id": self.id, "imported_count": added, "updated_count": changed,
                "total_count": added + changed, "rooms": self.rooms()}

    def import_matrix(self, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        records = 0
        with store().tx(quiet=True):
            for item in rows:
                n = num(item.get("room_number"))
                if not n:
                    continue
                u = self.unit(n)
                form = {k: item[k] for k in ("name", "pay_timing") if item.get(k) and (k != "name" or not u.active())}
                if form:
                    u.update(form)
                c = u.latest()
                for p in item.get("payments", []):
                    y, m, total = num(p.get("year")) or today().year, num(p.get("month")) or 1, num(p.get("amount"))
                    maint = 0 if (c and c.lease_type == "전세") else (min(c.maintenance, total) if c and c.maintenance > 0 else 0)
                    paid = bool(p.get("paid"))
                    split = (0, total) if (c and c.lease_type == "전세") else (total - maint, maint)
                    Payment(id=Payment.pid(self.id, n, y, m), building_id=self.id, unit=n, year=y, month=m, paid=paid,
                            paid_date=str(p.get("paid_date") or ""), note=str(p.get("note") or ""),
                            tenant_name=item.get("name") or (c.tenant_name if c else ""),
                            rent_amount=split[0] if paid else None, maintenance_amount=split[1] if paid else None).save()
                    records += 1
        return {"success": True, "branch_id": self.id, "total_rooms": len(rows), "updated_records": records, "rooms": self.rooms()}

    # ── 백업 / 복원 (레거시 백업 JSON과 동일한 모양 → 양방향 호환) ──
    def backup(self) -> Dict[str, Any]:
        rooms, hist = self.rooms(), [h.history_row() for h in self.histories()]
        exps = [e.model_dump() | {"branch_id": self.id} for e in self.expenses()]
        return {"version": "4.0", "system": "MQnet Rent2 (Object Model)", "backup_type": "FULL_SYSTEM_BACKUP",
                "exported_at": today().isoformat(), "branch_id": self.id, "branch_name": self.name,
                "rooms_count": len(rooms), "expenses_count": len(exps), "tenant_histories_count": len(hist),
                "data": {"rooms": rooms, "expenses": exps, "tenantHistories": hist}}

    def restore(self, block: Dict[str, Any]) -> Dict[str, Any]:
        rooms = block.get("rooms") or {}
        if isinstance(rooms, list):
            rooms = {r.get("room_number") or r.get("number"): r for r in rooms}
        rooms = {num(k): r for k, r in rooms.items() if num(k)}
        with store().tx(quiet=True):
            for n, r in rooms.items():
                Contract.purge(self.id, unit=n)
                Payment.purge(self.id, unit=n)
                if r.get("name"):
                    fields = self._contract_fields(r)
                    memo_dict: Dict[str, Any] = r.get("metadata_json") or {}
                    Contract(building_id=self.id, unit=n, tenant_name=fields["tenant_name"],
                             id_number=fields["id_number"], phone=fields["phone"],
                             lease_type=fields["lease_type"], pay_timing=fields["pay_timing"],
                             deposit=fields["deposit"], rent=fields["rent"],
                             maintenance=fields["maintenance"], clean_fee=fields["clean_fee"],
                             move_in=fields["move_in"], expiry=fields["expiry"],
                             move_out=fields["move_out"], memo=memo_dict).save()
                self.add_unit(n)
            for h in block.get("tenantHistories") or []:
                n, out = num(h.get("room_number")), h.get("move_out") or h.get("move_out_date") or today().isoformat()
                name = h.get("name") or h.get("tenant_name") or "전출자"
                if n and not any(c.tenant_name == name and c.move_out == out for c in Contract.find(self.id, unit=n)):
                    fields = self._contract_fields(h)
                    memo_dict = h.get("metadata_json") or {}
                    Contract(building_id=self.id, unit=n, tenant_name=name, move_out=out,
                             id_number=fields["id_number"], phone=fields["phone"],
                             lease_type=fields["lease_type"], pay_timing=fields["pay_timing"],
                             deposit=fields["deposit"], rent=fields["rent"],
                             maintenance=fields["maintenance"], clean_fee=fields["clean_fee"],
                             move_in=fields["move_in"], expiry=fields["expiry"], memo=memo_dict).save()
                    self.add_unit(n)
            for n, r in rooms.items():      # 수납: 계산 규칙과 다른 '사실'만 기록으로 남긴다
                u, seen = self.unit(n), set()
                for p in (r.get("payments") or {}).values():
                    y, m = num(p.get("year")) or today().year, num(p.get("month"))
                    if not 1 <= m <= 12 or (y, m) in seen:
                        continue
                    seen.add((y, m))
                    if _differs(u.period(y, m), p):
                        Payment(id=Payment.pid(self.id, n, y, m), building_id=self.id, unit=n, year=y, month=m,
                                paid=bool(p.get("paid")), paid_date=p.get("paid_date") or "", note=p.get("note") or "",
                                tenant_name=p.get("tenant_name") or "", tenant_id_number=p.get("tenant_id_number") or "",
                                rent_amount=num(p.get("rent_amount")), maintenance_amount=num(p.get("maintenance_amount"))).save()
            if block.get("expenses") is not None:
                Expense.purge(self.id)
                for e in block["expenses"]:
                    Expense(building_id=self.id, date=e.get("date") or today().isoformat(), item=e.get("item") or e.get("category") or "지출",
                            amount=num(e.get("amount")), note=e.get("note") or e.get("description") or "",
                            receipt_type=e.get("receipt_type") or "", receipt_info=e.get("receipt_info") or "").save()
        return {"success": True, "message": "백업 데이터가 성공적으로 복원되었습니다.", "target_branch_id": self.id,
                "rooms": self.rooms(), "expenses": [e.model_dump() for e in self.expenses()],
                "tenantHistories": [h.history_row() for h in self.histories()]}

    @staticmethod
    def _contract_fields(r: Dict[str, Any]) -> Dict[str, Any]:
        f = {attr: (num(r.get(k)) if k in MONEY else str(r.get(k) or "")) for k, attr in FORM.items() if k not in ("name", "move_out")}
        f.update(tenant_name=str(r.get("name") or ""), move_out=str(r.get("move_out") or ""))
        f["lease_type"], f["pay_timing"] = f["lease_type"] or "월세", f["pay_timing"] or "후불"
        return f


def _differs(base: Dict[str, Any], p: Dict[str, Any]) -> bool:
    """레거시 수납 행이 계산값과 다른가? (다를 때만 '사실 기록'으로 남긴다)"""
    return (bool(p.get("paid")) != base["paid"] or (p.get("paid_date") or "") != base["paid_date"]
            or num(p.get("rent_amount")) != base["rent_amount"] or num(p.get("maintenance_amount")) != base["maintenance_amount"]
            or (p.get("tenant_name") or "공실") != base["tenant_name"]
            or (p.get("note") or "") not in ("", base["note"], "정상 입금", "공실"))
