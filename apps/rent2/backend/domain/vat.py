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
           rooms: Optional[List[int]] = None, include_non_vat: bool = False) -> Dict[str, Any]:
    year, months, rows = year or today().year, list(range(start, end + 1)), []
    for u in b.view():
        if rooms and u.number not in rooms:
            continue
        c = u.latest()
        is_vat_target = getattr(c, "vat_target", True) if c else True
        # [비즈니스 규칙] 부가세 산출 제외 실은 부가가치세 신고 목록 및 집계에서 완전히 제외
        if not is_vat_target and not include_non_vat:
            continue

        ps = {m: u.period(year, m) for m in months}
        
        # [비즈니스 규칙] 임차인이 있는 경우 미납액도 부가세 포함됨 (공급시기 도래 원칙)
        amounts = {}
        for m in months:
            p = ps[m]
            if p["vacancy"]:
                amounts[m] = 0
            else:
                amt = p.get("rent_amount")
                if amt is not None and amt > 0:
                    amounts[m] = amt
                elif c and c.monthly_rent > 0:
                    amounts[m] = c.monthly_rent
                else:
                    amounts[m] = 0

        is_vat_sep = getattr(c, "vat_separate", False) if c else False
        raw_sum = sum(amounts.values())

        if not is_vat_target:
            # 1. 부가세 산출 제외 실 (면세/비과세 실)
            vat_label = "제외(면세)"
            total = raw_sum
            supply = raw_sum
            vat_val = 0
        elif is_vat_sep:
            # 2. 부가세 별도 수납 실 (세금영수증/계산서 별도 발행)
            vat_label = "별도(발행)"
            supply = raw_sum
            vat_val = round(supply * 0.1)
            total = supply + vat_val
        else:
            # 3. 부가세 포함 수납 실 (일반 과세 실)
            vat_label = "포함"
            total = raw_sum
            supply = round(total / 1.1)
            vat_val = total - supply

        rows.append({
            "room_number": u.number,
            "tenant_name": _display((c.tenant_name if c else "") or "공실", {p["tenant_name"] for p in ps.values() if not p["vacancy"]}),
            "id_number": c.id_number if c else "",
            "lease_type": c.lease_type if c else "월세",
            "vat_target": is_vat_target,
            "vat_separate": is_vat_sep,
            "vat_included": (not is_vat_sep) if is_vat_target else False,
            "vat_label": vat_label,
            "deposit": c.deposit if c else 0,
            "monthly_amounts": amounts,
            "period_total": total,
            "supply_value": supply,
            "vat_value": vat_val
        })
    return {"success": True, "branch_id": b.id, "year": year, "start_month": start, "end_month": end, "months": months,
            "total_collected": sum(r["period_total"] for r in rows), "total_supply": sum(r["supply_value"] for r in rows),
            "total_vat": sum(r["vat_value"] for r in rows), "saved_vat_target_rooms": b.vat_target_rooms, "rows": rows}


def _table(d: Dict[str, Any]) -> Tuple[list, list, list]:
    ms = d["months"]
    head = ["호실", "임차인", "주민(사업자)번호", "임대유형", "부가세", "보증금", *[f"{m}월" for m in ms], "기간총합계(VAT포함)", "공급가액", "부가가치세(10%)"]
    body = [[r["room_number"], r["tenant_name"], r["id_number"] or "-", r["lease_type"], r.get("vat_label", "포함"), r["deposit"],
             *[r["monthly_amounts"][m] for m in ms], r["period_total"], r["supply_value"], r["vat_value"]] for r in d["rows"]]
    sums = [sum(r["monthly_amounts"][m] for r in d["rows"]) for m in ms]
    foot = ["합계", f'총 {len(body)}개실', "-", "-", "-", sum(r["deposit"] for r in d["rows"]), *sums,
            d["total_collected"], d["total_supply"], d["total_vat"]]
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


# ───────────────────────────── 종합소득세 (총수입금액 및 필요경비) ─────────────────────────────
def income_tax_report(b: Building, year: Optional[int] = None) -> Dict[str, Any]:
    """
    종합소득세 부동산 임대소득 신고자료 집계:
    1. 총수입금액: 1년치(1~12월) 실제 수납된 순수 임대료 합계 (전세/관리비 제외)
    2. 필요경비: 세무 증빙유형별(세금계산서, 신용카드, 현금영수증, 간이영수증) 및 계정과목별 집계
    """
    year = year or today().year
    # 1. 1년치 임대료 수입 집계
    vat_all = report(b, start=1, end=12, year=year)
    total_rent_income = vat_all["total_collected"]
    total_deposit = sum(r["deposit"] for r in vat_all["rows"])

    # 2. 필요경비(Expense) 집계
    exps = [e for e in b.expenses() if e.date.startswith(str(year))]
    
    # 증빙유형별 분류
    by_receipt: Dict[str, int] = {"세금계산서": 0, "신용카드": 0, "현금영수증": 0, "간이영수증": 0, "기타/미증빙": 0}
    # 계정과목별 분류
    by_category: Dict[str, int] = {"수선유지비": 0, "수도광열비": 0, "청소용역비": 0, "화재보험료": 0, "소모품비": 0, "기타경비": 0}
    
    detailed_expenses = []
    for e in exps:
        amt = e.amount
        # 증빙 매핑
        rcpt = e.receipt_type or "간이영수증"
        if "세금" in rcpt or "계산서" in rcpt:
            by_receipt["세금계산서"] += amt
        elif "카드" in rcpt or "신용" in rcpt:
            by_receipt["신용카드"] += amt
        elif "현금" in rcpt:
            by_receipt["현금영수증"] += amt
        elif "간이" in rcpt:
            by_receipt["간이영수증"] += amt
        else:
            by_receipt["기타/미증빙"] += amt

        # 계정과목 매핑
        item = e.item
        if any(w in item for w in ("도배", "장판", "수리", "교체", "보일러", "수선", "배관", "방수")):
            by_category["수선유지비"] += amt
        elif any(w in item for w in ("전기", "수도", "가스", "공과금", "정화조")):
            by_category["수도광열비"] += amt
        elif any(w in item for w in ("청소", "위탁", "소독", "방역", "관리용역")):
            by_category["청소용역비"] += amt
        elif "보험" in item:
            by_category["화재보험료"] += amt
        elif any(w in item for w in ("소모품", "건전지", "비품", "등기구", "도어락")):
            by_category["소모품비"] += amt
        else:
            by_category["기타경비"] += amt

        detailed_expenses.append({
            "id": e.id, "date": e.date, "item": e.item, "amount": amt,
            "receipt_type": e.receipt_type or "간이영수증", "note": e.note
        })

    total_expense = sum(e.amount for e in exps)
    net_income = total_rent_income - total_expense

    return {
        "success": True,
        "branch_id": b.id,
        "branch_name": b.name,
        "year": year,
        "total_rent_income": total_rent_income,
        "total_deposit": total_deposit,
        "total_expense": total_expense,
        "net_income": net_income,
        "by_receipt": by_receipt,
        "by_category": by_category,
        "expenses": detailed_expenses,
        "room_summaries": vat_all["rows"]
    }


def income_tax_csv_bytes(d: Dict[str, Any]) -> bytes:
    lines = [
        f'"[종합소득세 부동산임대소득 집계표 ({d["year"]}년 귀속)]"',
        f'"사업장","{d["branch_name"]} ({d["branch_id"]})"',
        f'"총수입금액(연간 임대료)","{d["total_rent_income"]:,}원"',
        f'"필요경비 총액","{d["total_expense"]:,}원"',
        f'"예상 임대소득금액","{d["net_income"]:,}원"',
        "",
        '"[1. 세무 증빙유형별 경비 집계]"',
        '"증빙구분","금액","비고"',
    ]
    for k, v in d["by_receipt"].items():
        note = "적격증빙" if k in ("세금계산서", "신용카드", "현금영수증") else ("3만원 초과 시 가산세 주의" if k == "간이영수증" else "")
        lines.append(f'"{k}","{v:,}","{note}"')

    lines += [
        "",
        '"[2. 계정과목별 경비 집계]"',
        '"과목","금액"',
    ]
    for k, v in d["by_category"].items():
        lines.append(f'"{k}","{v:,}"')

    lines += [
        "",
        '"[3. 개별 지출 전표 내역]"',
        '"일자","항목","금액","증빙종류","적요"',
    ]
    for e in d["expenses"]:
        lines.append(f'"{e["date"]}","{e["item"]}","{e["amount"]}","{e["receipt_type"]}","{e["note"]}"')

    return ("\n".join(lines) + "\n").encode("utf-8-sig")


def income_tax_excel_bytes(d: Dict[str, Any]) -> bytes:
    title = f'부동산 임차관리 - 종합소득세 임대소득 및 필요경비 명세서 ({d["year"]}년 귀속)'
    cell = lambda v, tag="td": (f'<{tag} style="border:1px solid #000;padding:6px;' + ("text-align:right;mso-number-format:\'#,##0\';" if isinstance(v, int) else "text-align:left;") + f'">{f"{v:,}" if isinstance(v, int) else v}</{tag}>')
    tr = lambda r, tag="td": "<tr>" + "".join(cell(v, tag) for v in r) + "</tr>"

    html = f"""<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>
<body style="font-family:'Malgun Gothic',sans-serif;color:#000;background:#fff">
  <h2 style="margin:10px 0">{title}</h2>
  <p><b>사업장:</b> {d["branch_name"]} | <b>총수입금액:</b> {d["total_rent_income"]:,}원 | <b>필요경비:</b> {d["total_expense"]:,}원 | <b>소득금액:</b> {d["net_income"]:,}원</p>
  
  <h3>1. 증빙별 집계</h3>
  <table style="border-collapse:collapse;margin-bottom:20px">
    <tr><th style="border:1px solid #000;padding:6px;background:#f0f0f0">증빙 구분</th><th style="border:1px solid #000;padding:6px;background:#f0f0f0">금액</th></tr>
    {"".join(f"<tr><td style='border:1px solid #000;padding:6px'>{k}</td><td style='border:1px solid #000;padding:6px;text-align:right'>{v:,}</td></tr>" for k, v in d["by_receipt"].items())}
  </table>

  <h3>2. 지출 전표 목록</h3>
  <table style="border-collapse:collapse">
    <tr><th style="border:1px solid #000;padding:6px;background:#f0f0f0">일자</th><th style="border:1px solid #000;padding:6px;background:#f0f0f0">항목</th><th style="border:1px solid #000;padding:6px;background:#f0f0f0">금액</th><th style="border:1px solid #000;padding:6px;background:#f0f0f0">증빙유형</th><th style="border:1px solid #000;padding:6px;background:#f0f0f0">적요</th></tr>
    {"".join(f"<tr><td style='border:1px solid #000;padding:6px'>{e['date']}</td><td style='border:1px solid #000;padding:6px'>{e['item']}</td><td style='border:1px solid #000;padding:6px;text-align:right'>{e['amount']:,}</td><td style='border:1px solid #000;padding:6px'>{e['receipt_type']}</td><td style='border:1px solid #000;padding:6px'>{e['note']}</td></tr>" for e in d["expenses"])}
  </table>
</body></html>"""
    return html.encode("utf-8")

