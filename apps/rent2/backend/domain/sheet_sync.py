"""
domain/sheet_sync.py — 구글 스프레드시트(시크빌 장부) 2025년/2026년 자동 동기화 엔진.
- 구글 시트 URL에서 2025년 및 2026년 호실별 계약 및 월별 납부내역(납부일, 임차료, 관리비, 공실/전입 메모)을 추출하여
  rent2의 Contract 및 Payment 객체에 원자적(Atomic)으로 적재한다.
"""
import csv
import io
import re
import ssl
import urllib.request
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from ..kernel.base import store
from .rent import Building, Contract, Payment, num, pdate, today

DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1Yfcc3sfIsgd76aaw_HVfMtU2LdEVdHvcO5YIKaDsAcI/edit?gid=944651128#gid=944651128"


def extract_sheet_id_and_gid(url: str) -> Tuple[str, str]:
    """구글 시트 URL에서 sheet_id와 gid 추출"""
    sid_match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    gid_match = re.search(r"[?&#]gid=([0-9]+)", url)
    sheet_id = sid_match.group(1) if sid_match else ""
    gid = gid_match.group(1) if gid_match else "0"
    return sheet_id, gid


def fetch_sheet_csv(url: str) -> str:
    """구글 시트의 CSV 내보내기 엔드포인트에서 UTF-8 원본 텍스트 다운로드"""
    sheet_id, gid = extract_sheet_id_and_gid(url)
    if not sheet_id:
        raise ValueError("유효한 구글 스프레드시트 URL이 아닙니다.")

    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        export_url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
        raw = res.read()
        return raw.decode("utf-8", errors="replace")


def parse_day_to_iso(year: int, month: int, day_str: str) -> str:
    """
    다양한 날짜 표기를 ISO 날짜(YYYY-MM-DD)로 변환:
    - '1. 3' -> YYYY-01-03
    - '115' (1월 15일) -> YYYY-01-15
    - '1018' (10월 18일) -> YYYY-10-18
    - '11-3' -> YYYY-11-03
    - '25-12-3' -> 2025-12-03
    - '2. 19' -> YYYY-02-19
    """
    s = (day_str or "").strip()
    if not s or any(kw in s for kw in ("공실", "전입", "전출", "만기")):
        return ""

    # '25-12-3' 또는 '2025-12-03'
    m_full = re.search(r"(?:20)?(\d{2})[-./](\d{1,2})[-./](\d{1,2})", s)
    if m_full:
        yr = int("20" + m_full.group(1)) if len(m_full.group(1)) == 2 else int(m_full.group(1))
        return f"{yr:04d}-{int(m_full.group(2)):02d}-{int(m_full.group(3)):02d}"

    # '1. 15', '1/15', '1-15'
    m_md = re.search(r"(\d{1,2})\s*[-./]\s*(\d{1,2})", s)
    if m_md:
        mo, d = int(m_md.group(1)), int(m_md.group(2))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{year:04d}-{mo:02d}-{d:02d}"

    # '115' (1월 15일), '1018' (10월 18일), '325' (3월 25일)
    m_concat = re.search(r"^(\d{1,2})(\d{2})$", s)
    if m_concat:
        mo, d = int(m_concat.group(1)), int(m_concat.group(2))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{year:04d}-{mo:02d}-{d:02d}"

    # 단순 일자 숫자만 있는 경우 ('15', '3')
    m_d = re.search(r"^(\d{1,2})$", s)
    if m_d:
        d = int(m_d.group(1))
        if 1 <= d <= 31:
            return f"{year:04d}-{month:02d}-{d:02d}"

    return ""


def sync_file_data(file_path: str, building_id: str = "main") -> Dict[str, Any]:
    """로컬 엑셀(.xlsx) 또는 CSV/TSV 파일에서 2025/2026년 장부 데이터를 읽어 동기화"""
    import os
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"지정된 파일 경로가 존재하지 않습니다: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".xlsx" or ext == ".xls":
        try:
            import openpyxl  # type: ignore[import-untyped]
            wb = openpyxl.load_workbook(file_path, data_only=True)
            ws = wb.active if wb.active is not None else (wb.worksheets[0] if wb.worksheets else None)
            if ws is None:
                raise ValueError("유효한 워크시트가 존재하지 않습니다.")
            rows = [[str(cell.value or "") if cell.value is not None else "" for cell in row] for row in ws.iter_rows()]
        except Exception as e:
            raise ValueError(f"엑셀 파일 읽기 실패 ({os.path.basename(file_path)}): {str(e)}")
    else:
        delimiter = "\t" if ext == ".tsv" else ","
        try:
            with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
                reader = csv.reader(f, delimiter=delimiter)
                rows = list(reader)
        except Exception as e:
            raise ValueError(f"CSV 파일 읽기 실패: {str(e)}")

    return sync_rows_data(rows, building_id, source_label=os.path.basename(file_path))


def sync_sheet_data(sheet_url: str = DEFAULT_SHEET_URL, building_id: str = "main") -> Dict[str, Any]:
    """구글 시트에서 2025년과 2026년 데이터를 추출하여 Building 데이터로 일괄 반영"""
    csv_text = fetch_sheet_csv(sheet_url)
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    return sync_rows_data(rows, building_id, source_label="구글 스프레드시트")


def sync_rows_data(rows: List[List[str]], building_id: str = "main", source_label: str = "스프레드시트") -> Dict[str, Any]:
    """행(Row) 리스트에서 2025년과 2026년 섹션을 파싱하여 Building 데이터로 일괄 반영"""
    b = Building.require(building_id)

    # 1. 2025년과 2026년 섹션 행 범위 탐색
    sections: List[Tuple[int, int, int]] = []  # (year, start_row, end_row)
    cur_year = None
    cur_start = None

    for i, row in enumerate(rows):
        line = " ".join(row).strip()
        m_yr = re.search(r"(202\d)\s*년도", line)
        if m_yr:
            yr = int(m_yr.group(1))
            if cur_year and cur_start is not None:
                sections.append((cur_year, cur_start, i - 1))
            cur_year = yr
            cur_start = None
            continue

        if cur_year and cur_start is None and "호실" in line and ("세입자" in line or "성명" in line or "전화번호" in line):
            cur_start = i + 1
            continue

    if cur_year and cur_start is not None:
        sections.append((cur_year, cur_start, len(rows) - 1))

    if not sections:
        raise ValueError("시트에서 '2025년도' 또는 '2026년도' 표 섹션을 찾을 수 없습니다.")

    parsed_rooms: Dict[int, Dict[str, Any]] = {}
    parsed_payments: Dict[Tuple[int, int, int], Dict[str, Any]] = {} # (unit, year, month) -> payment dict

    for yr, s_idx, e_idx in sections:
        for r_idx in range(s_idx, e_idx + 1):
            if r_idx >= len(rows):
                break
            row = rows[r_idx]
            if not row or not row[0].strip():
                continue
            room_str = row[0].strip()
            if not re.match(r"^\d{3,4}$", room_str):
                continue

            unit: int = int(room_str)
            tenant: str = row[1].strip() if len(row) > 1 else ""
            id_num: str = row[2].strip() if len(row) > 2 else ""
            phone: str = row[3].strip() if len(row) > 3 else ""
            move_in: str = ""
            move_out: str = ""
            lease_type: str = "월세"
            pay_timing: str = "후불"
            deposit: int = 0
            if len(row) > 4:
                d_in = pdate(row[4])
                if d_in:
                    move_in = d_in.isoformat()
            if len(row) > 5:
                d_out = pdate(row[5])
                if d_out:
                    move_out = d_out.isoformat()

            if len(row) > 6 and "전세" in row[6]:
                lease_type = "전세"

            if len(row) > 7 and "선불" in row[7]:
                pay_timing = "선불"

            if len(row) > 8:
                deposit = num(row[8])

            # 2026년 세입자 정보를 우선 기본 계약으로 채택
            if yr == 2026 or unit not in parsed_rooms:
                # 1~12월 중 가장 빈번한 임차료 및 관리비 탐색
                rents = []
                maints = []
                for mo in range(1, 13):
                    col_base = 9 + (mo - 1) * 3
                    if col_base + 2 < len(row):
                        r_amt = num(row[col_base + 1])
                        m_amt = num(row[col_base + 2])
                        if r_amt > 0:
                            rents.append(r_amt)
                        if m_amt > 0:
                            maints.append(m_amt)

                default_rent = rents[0] if rents else 290000
                default_maint = maints[0] if maints else 150000
                if lease_type == "전세":
                    default_rent = 0

                parsed_rooms[unit] = {
                    "unit": unit,
                    "tenant_name": tenant,
                    "id_number": id_num,
                    "phone": phone,
                    "lease_type": lease_type,
                    "pay_timing": pay_timing,
                    "deposit": deposit,
                    "rent": default_rent,
                    "maintenance": default_maint,
                    "move_in": move_in,
                    "expiry": move_out,
                }

            # 1월 ~ 12월 납부 기록 파싱
            for mo in range(1, 13):
                col_base = 9 + (mo - 1) * 3
                if col_base + 2 < len(row):
                    pay_day_raw = row[col_base].strip()
                    rent_raw = row[col_base + 1].strip()
                    maint_raw = row[col_base + 2].strip()

                    rent_amt = num(rent_raw)
                    maint_amt = num(maint_raw)
                    p_date = parse_day_to_iso(yr, mo, pay_day_raw)

                    # 납부 여부 판정
                    # 1. 금액이 있거나 납부일자가 파싱된 경우 -> 납부 완료
                    is_paid = bool((rent_amt > 0 or maint_amt > 0) and (p_date or pay_day_raw))
                    # 2. 전세(월세 0원)인데 관리비만 낸 경우 -> 납부 완료
                    if lease_type == "전세" and maint_amt > 0:
                        is_paid = True

                    note = pay_day_raw
                    # '공실' 표기
                    if "공실" in pay_day_raw:
                        is_paid = False
                        note = pay_day_raw
                    elif "전입" in pay_day_raw:
                        note = pay_day_raw

                    parsed_payments[(unit, yr, mo)] = {
                        "unit": unit,
                        "year": yr,
                        "month": mo,
                        "paid": is_paid,
                        "paid_date": p_date or (f"{yr}-{mo:02d}-10" if is_paid else ""),
                        "rent_amount": rent_amt if is_paid else None,
                        "maintenance_amount": maint_amt if is_paid else None,
                        "note": note,
                        "tenant_name": tenant,
                        "tenant_id_number": id_num
                    }

    # 1.5. 2025년 납부 실적이 있으나 갱신계약으로 move_in이 2026년으로 적힌 경우 move_in 안전 보정
    for yr, s_idx, e_idx in sections:
        if yr == 2025:
            for r_idx in range(s_idx, e_idx + 1):
                if r_idx >= len(rows):
                    break
                row = rows[r_idx]
                if not row or not re.match(r"^\d{3,4}$", row[0].strip()):
                    continue
                unit = int(row[0].strip())
                if unit not in parsed_rooms:
                    continue
                cur_mi = parsed_rooms[unit].get("move_in") or ""
                # 2025년에 유효한 납부내역이 있는지 확인
                earliest_paid_month = None
                for mo in range(1, 13):
                    col_base = 9 + (mo - 1) * 3
                    if col_base + 2 < len(row):
                        r_amt = num(row[col_base + 1])
                        m_amt = num(row[col_base + 2])
                        p_day = row[col_base].strip()
                        if (r_amt > 0 or m_amt > 0 or "전입" in p_day) and "공실" not in p_day:
                            earliest_paid_month = mo
                            break
                if earliest_paid_month and (not cur_mi or cur_mi >= "2026-01-01"):
                    # 2025년 1월 메모에 '전입 1/17' 등이 있으면 해당 일자 채택
                    day_memo = row[9].strip() if len(row) > 9 else ""
                    m_memo = re.search(r"(\d{1,2})[./\s-](\d{1,2})", day_memo)
                    if m_memo:
                        adj_date = f"2025-{int(m_memo.group(1)):02d}-{int(m_memo.group(2)):02d}"
                    else:
                        adj_date = f"2025-{earliest_paid_month:02d}-01"
                    parsed_rooms[unit]["move_in"] = adj_date

    # DB에 트랜잭션으로 원자적 저장
    updated_units = sorted(parsed_rooms.keys())
    saved_payments_count = 0

    with store().tx(quiet=True):
        b.units = updated_units
        b.save("units_synced")

        for u_num, r_info in parsed_rooms.items():
            # 기존 계약 갱신 또는 신규 생성
            contracts = Contract.find(b.id, unit=u_num)
            c = next((c for c in contracts if c.active), None) or (contracts[0] if contracts else None)
            if not c:
                c = Contract(building_id=b.id, unit=u_num)

            c.tenant_name = r_info["tenant_name"]
            c.id_number = r_info["id_number"]
            c.phone = r_info["phone"]
            c.lease_type = r_info["lease_type"]
            c.pay_timing = r_info["pay_timing"]
            c.deposit = r_info["deposit"]
            c.rent = r_info["rent"]
            c.maintenance = r_info["maintenance"]
            if r_info["move_in"]:
                c.move_in = r_info["move_in"]
            if r_info["expiry"]:
                c.expiry = r_info["expiry"]
            c.save("sheet_synced")

        for (u_num, yr, mo), p_info in parsed_payments.items():
            pid = Payment.pid(b.id, u_num, yr, mo)
            Payment(
                id=pid,
                building_id=b.id,
                unit=u_num,
                year=yr,
                month=mo,
                paid=p_info["paid"],
                paid_date=p_info["paid_date"],
                rent_amount=p_info["rent_amount"],
                maintenance_amount=p_info["maintenance_amount"],
                note=p_info["note"],
                tenant_name=p_info["tenant_name"],
                tenant_id_number=p_info["tenant_id_number"]
            ).save("sheet_synced")
            saved_payments_count += 1

    return {
        "success": True,
        "branch_id": b.id,
        "branch_name": b.name,
        "source": source_label,
        "synced_years": [2025, 2026],
        "total_rooms": len(updated_units),
        "rooms": updated_units,
        "total_payments_synced": saved_payments_count,
        "message": f"[{source_label}] 2025년 및 2026년 {len(updated_units)}개 호실, 총 {saved_payments_count}건의 납부내역이 성공적으로 동기화되었습니다."
    }
