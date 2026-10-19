import csv
import sys
import re

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def parse_date(date_raw, month, default_day=25):
    if not date_raw:
        return ""
    d = date_raw.strip().replace(" ", "")
    
    # 25-12-3 -> 2025-12-03
    m_full = re.match(r"(\d{2,4})[-.](\d{1,2})[-.](\d{1,2})", d)
    if m_full:
        y, mo, day = m_full.groups()
        return f"2025-{int(mo):02d}-{int(day):02d}"
    
    # 2.3, 10-23, 11-3, 7/3
    m_md = re.match(r"(\d{1,2})[-./:](\d{1,2})", d)
    if m_md:
        mo, day = m_md.groups()
        # If mo > 12, might be day:min or typo, fallback to month
        m_int = int(mo) if int(mo) <= 12 else month
        d_int = int(day) if int(day) <= 31 else default_day
        return f"2025-{m_int:02d}-{d_int:02d}"
    
    # 1015 -> 10.15, 115 -> 1.15
    if d.isdigit():
        if len(d) == 4:
            mo = int(d[:2])
            day = int(d[2:])
            if 1 <= mo <= 12 and 1 <= day <= 31:
                return f"2025-{mo:02d}-{day:02d}"
        elif len(d) == 3:
            mo = int(d[0])
            day = int(d[1:])
            if 1 <= mo <= 12 and 1 <= day <= 31:
                return f"2025-{mo:02d}-{day:02d}"
            
    return ""

def test():
    with open("data/chicvill_2025.csv", "r", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    room_rows = [r for r in rows if len(r) > 0 and r[0].strip().isdigit()]
    print(f"Total rooms: {len(room_rows)}")

    total_sum_2025 = 0
    h1_sum = 0
    h2_sum = 0
    paid_count = 0

    for r in room_rows:
        room_no = int(r[0].strip())
        name = r[1].strip()
        timing = r[2].strip()

        for m in range(1, 13):
            d_col = 3 + 2 * m
            a_col = 4 + 2 * m
            d_raw = r[d_col].strip() if d_col < len(r) else ""
            a_raw = r[a_col].strip() if a_col < len(r) else ""

            # Check if note is in amount column (like '전입', '공실', '미납' or date like '5/26')
            note = ""
            if any(k in a_raw for k in ["공실", "전입", "미납", "주인"]) or ("/" in a_raw and not any(k in a_raw for k in [",", "000"])):
                note = a_raw
                a_raw = ""
            if any(k in d_raw for k in ["공실", "전입", "미납", "주인"]):
                note = (note + " " + d_raw).strip()

            clean_digits = re.sub(r"[^\d]", "", a_raw)
            amt = int(clean_digits) if clean_digits else 0

            paid = (amt > 0)
            paid_date = parse_date(d_raw, m) if paid else ""
            if paid and not paid_date:
                paid_date = f"2025-{m:02d}-25"

            if amt > 0 and amt % 10000 != 0:
                print(f"Room {room_no} Month {m}: raw_amt='{a_raw}', raw_date='{d_raw}', parsed={amt:,}")

            if paid:
                paid_count += 1
                total_sum_2025 += amt
                if m <= 6:
                    h1_sum += amt
                else:
                    h2_sum += amt

    print(f"Paid records: {paid_count}")
    print(f"Total 2025 collected: {total_sum_2025:,} 원")
    print(f"  - 1기 (1~6월): {h1_sum:,} 원 (공급가: {round(h1_sum/1.1):,} 원, 부가세: {h1_sum - round(h1_sum/1.1):,} 원)")
    print(f"  - 2기 (7~12월): {h2_sum:,} 원 (공급가: {round(h2_sum/1.1):,} 원, 부가세: {h2_sum - round(h2_sum/1.1):,} 원)")

if __name__ == "__main__":
    test()
