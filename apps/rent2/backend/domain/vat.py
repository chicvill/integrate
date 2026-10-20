"""
domain/vat.py — 부가세 신고 보고서: 순수 월세(관리비·전세 제외) 기준 공급가액 = 합계 ÷ 1.1, 부가세 = 차액.
월별 금액은 호실 객체의 period() 규칙을 그대로 쓰므로 별도의 세무용 판정 로직이 없다.
"""
from typing import Any, Dict, List, Optional, Tuple

from .rent import Building, today


def _display(curr: str, seen: set) -> str:
    """전출자 납부 이력이 섞인 기간이면 '현재 (전: 이전)' 으로 표기"""
    others = sorted(n for n in seen if n != curr)
    if not others:
        return curr
    if len(seen) > 1 or curr != "공실":
        return f"{curr} (전: {', '.join(others)})"
    return f"{others[0]} (전출)"


def report(b: Building, start: int = 1, end: int = 6, year: Optional[int] = None,
           rooms: Optional[List[int]] = None) -> Dict[str, Any]:
    year, months, rows = year or today().year, list(range(start, end + 1)), []
    for u in b.view():
        if rooms and u.number not in rooms:
            continue
        ps = {m: u.period(year, m) for m in months}
        amounts = {m: 0 if p["vacancy"] else p["rent_amount"] for m, p in ps.items()}
        total = sum(amounts.values())
        supply = round(total / 1.1)
        c = u.latest()
        rows.append({"room_number": u.number, "tenant_name": _display((c.tenant_name if c else "") or "공실", {p["tenant_name"] for p in ps.values() if not p["vacancy"]}),
                     "id_number": c.id_number if c else "", "lease_type": c.lease_type if c else "월세", "deposit": c.deposit if c else 0,
                     "monthly_amounts": amounts, "period_total": total, "supply_value": supply, "vat_value": total - supply,
                     "status": "완납" if all(p["paid"] for p in ps.values()) else ("미납" if total == 0 else "부분완납")})
    return {"success": True, "branch_id": b.id, "year": year, "start_month": start, "end_month": end, "months": months,
            "total_collected": sum(r["period_total"] for r in rows), "total_supply": sum(r["supply_value"] for r in rows),
            "total_vat": sum(r["vat_value"] for r in rows), "saved_vat_target_rooms": b.vat_target_rooms, "rows": rows}


def _table(d: Dict[str, Any]) -> Tuple[list, list, list]:
    ms = d["months"]
    head = ["호실", "임차인", "주민(사업자)번호", "임대유형", "보증금", *[f"{m}월" for m in ms], "기간총합계(VAT포함)", "공급가액", "부가가치세(10%)", "수납상태"]
    body = [[f'{r["room_number"]}호', r["tenant_name"], r["id_number"] or "-", r["lease_type"], r["deposit"],
             *[r["monthly_amounts"][m] for m in ms], r["period_total"], r["supply_value"], r["vat_value"], r["status"]] for r in d["rows"]]
    sums = [sum(r["monthly_amounts"][m] for r in d["rows"]) for m in ms]
    foot = ["합계", f'총 {len(body)}개실', "-", "-", sum(r["deposit"] for r in d["rows"]), *sums,
            d["total_collected"], d["total_supply"], d["total_vat"], "-"]
    return head, body, foot


def csv_bytes(d: Dict[str, Any]) -> bytes:
    head, body, foot = _table(d)
    q = lambda v: f'"{str(v).replace(chr(34), chr(34) * 2)}"' if isinstance(v, str) else str(v)   # noqa: E731
    lines = [",".join(q(h) for h in head)] + [",".join(q(v) for v in r) for r in (*body, foot)]
    lines += ["", f'"[과세표준]","공급대가: {d["total_collected"]}원 (공급가액: {d["total_supply"]}원 | 부가세: {d["total_vat"]}원)"',
              '"[산출기준]","순수 임차료(월세) 기준 산출 (실비 정산 관리비 및 전세 제외)"']
    return ("\n".join(lines) + "\n").encode("utf-8-sig")


def excel_bytes(d: Dict[str, Any]) -> bytes:
    """엑셀에서 바로 열리는 HTML 표 형식 (.xls)"""
    head, body, foot = _table(d)
    cell = lambda v, tag="td": (f'<{tag} style="border:1px solid #94a3b8;padding:5px;' + ("text-align:right;mso-number-format:\'#,##0\';" if isinstance(v, int) else "text-align:left;") +   # noqa: E731
                                f'">{f"{v:,}" if isinstance(v, int) else v}</{tag}>')
    tr = lambda r, tag="td": "<tr>" + "".join(cell(v, tag) for v in r) + "</tr>"   # noqa: E731
    title = f'부동산 임차관리 - 부가가치세 및 기간별 수납현황 ({d["year"]}년 {d["start_month"]}월 ~ {d["end_month"]}월)'
    html = (f'<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>'
            f'<table style="border-collapse:collapse;font:11px \'Malgun Gothic\'"><tr><td colspan="{len(head)}" style="font:bold 15px sans-serif;padding:10px">{title}</td></tr>'
            f'{tr(head, "th")}{"".join(tr(r) for r in body)}{tr(foot)}</table></body></html>')
    return html.encode("utf-8")
