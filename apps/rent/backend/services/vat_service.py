"""
apps/rent/backend/services/vat_service.py
원룸 부가가치세(VAT) 세무 신고 및 과세 대상 호실 관리 전담 도메인 서비스 (Clean Architecture).
- 기간별(상반기/하반기/전체) 수납 집계 보고서
- 공급가액(1/1.1) 및 부가세(10%) 산출
- 전출자 납부 이력 결합 및 표시명 정밀 생성
- 지점/호실별 부가세 과세 대상 영구 저장 및 동기화
"""
from typing import List, Dict, Any, Optional, cast
from sqlalchemy.orm import Session

from ..db.models import RentBranch, RentRoom, RentTenantHistory


class VatService:
    @staticmethod
    def get_vat_settings(db: Session, branch_id: str = "main") -> Dict[str, Any]:
        """지점별 부가세 대상 호실 목록 DB 조회"""
        branch = db.query(RentBranch).filter(RentBranch.branch_id == branch_id).first()
        saved_rooms: Optional[List[int]] = None
        if branch and branch.metadata_json and isinstance(branch.metadata_json, dict):
            saved_rooms = branch.metadata_json.get("vat_target_rooms")

        # 만약 branch metadata에 없으면 room 개별 metadata에서 탐색
        if saved_rooms is None:
            rooms = db.query(RentRoom).filter(RentRoom.branch_id == branch_id).all()
            target_list: List[int] = []
            has_room_flag = False
            for rm in rooms:
                meta = rm.metadata_json or {}
                if "is_vat_target" in meta:
                    has_room_flag = True
                    if meta.get("is_vat_target"):
                        target_list.append(cast(int, rm.room_number))
            if has_room_flag:
                saved_rooms = sorted(target_list)

        return {
            "success": True,
            "branch_id": branch_id,
            "vat_target_rooms": saved_rooms
        }

    @staticmethod
    def save_vat_settings(
        db: Session,
        branch_id: str = "main",
        target_rooms: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """지점별 부가세 대상 호실 목록 DB 저장 및 영구 유지"""
        target_list: List[int] = sorted(list(set(target_rooms or [])))

        # 1. RentBranch 메타데이터 업데이트
        branch = db.query(RentBranch).filter(RentBranch.branch_id == branch_id).first()
        if branch:
            new_meta = dict(branch.metadata_json or {})
            new_meta["vat_target_rooms"] = target_list
            branch.metadata_json = new_meta

        # 2. 각 RentRoom 개별 메타데이터 동기화
        rooms = db.query(RentRoom).filter(RentRoom.branch_id == branch_id).all()
        for rm in rooms:
            rm_meta = dict(rm.metadata_json or {})
            rm_meta["is_vat_target"] = (cast(int, rm.room_number) in target_list)
            rm.metadata_json = rm_meta

        db.commit()
        return {
            "success": True,
            "branch_id": branch_id,
            "vat_target_rooms": target_list,
            "message": f"부가세 대상 호실 {len(target_list)}개실 설정이 DB에 영구 저장되었습니다."
        }

    @classmethod
    def get_vat_report(
        cls,
        db: Session,
        branch_id: str = "main",
        start_month: int = 1,
        end_month: int = 6,
        year: int = 2026,
        room_numbers: Optional[List[int]] = None,
        rooms_data: Optional[Dict[int, Dict[str, Any]]] = None,
        histories: Optional[List[RentTenantHistory]] = None
    ) -> Dict[str, Any]:
        """부가가치세 신고용 기간별(1~6월, 7~12월 등) 호실별 수납 집계 보고서"""
        if rooms_data is None:
            rooms_data = {}
        if histories is None:
            histories = []

        report_rows: List[Dict[str, Any]] = []
        total_collected = 0
        total_supply = 0
        total_vat = 0

        months = list(range(start_month, end_month + 1))

        # 전출자 이력 맵 (호실별)
        hist_map: Dict[int, List[RentTenantHistory]] = {}
        for h in histories:
            hist_map.setdefault(cast(int, h.room_number), []).append(h)

        target_rooms = sorted(rooms_data.keys())
        if room_numbers is not None and len(room_numbers) > 0:
            target_rooms = [r for r in target_rooms if r in room_numbers]

        for rNum in target_rooms:
            r = rooms_data[rNum]
            monthly_amounts: Dict[int, int] = {}
            room_period_total = 0
            tenant_names_seen = set()

            # 전입일 파싱
            move_in_str = r.get("move_in") or ""
            in_y, in_m = None, None
            if move_in_str and len(move_in_str) >= 7:
                try:
                    in_y = int(move_in_str[:4])
                    in_m = int(move_in_str[5:7])
                except (ValueError, TypeError):
                    pass

            room_hists = hist_map.get(rNum, [])

            for m in months:
                p = r.get("payments", {}).get(m, {})
                is_curr = False
                if r.get("name") and in_y is not None and in_m is not None:
                    if (year > in_y) or (year == in_y and m >= in_m):
                        is_curr = True

                matched_hist: Optional[RentTenantHistory] = None
                if not is_curr:
                    for h in room_hists:
                        h_out_y, h_out_m = None, None
                        h_move_out_str = str(h.move_out or "")
                        if len(h_move_out_str) >= 7:
                            try:
                                h_out_y = int(h_move_out_str[:4])
                                h_out_m = int(h_move_out_str[5:7])
                            except (ValueError, TypeError):
                                pass
                        h_in_y, h_in_m = 0, 0
                        h_move_in_str = str(h.move_in or "")
                        if len(h_move_in_str) >= 7:
                            try:
                                h_in_y = int(h_move_in_str[:4])
                                h_in_m = int(h_move_in_str[5:7])
                            except (ValueError, TypeError):
                                pass

                        if h_out_y and h_out_m:
                            in_period = (year < h_out_y or (year == h_out_y and m <= h_out_m))
                            if h_in_y and h_in_m:
                                in_period = in_period and (year > h_in_y or (year == h_in_y and m >= h_in_m))
                            if in_period:
                                matched_hist = h
                                break

                # 공실 여부 판정: 현 세입자 계약도 아니고 전출자 거주 기간도 아님
                is_vacant = (not is_curr and not matched_hist)

                amt: int = 0
                if is_vacant:
                    # 공실은 부가세 공급가액(수입)에서 완전 제외 (0원)
                    amt = 0
                else:
                    # 계약 기간: 순수 임차료(월세)만으로 부가세 공급대가 산출 (공공요금 실비 관리비 제외)
                    matched_lease_type = str(matched_hist.lease_type or "") if matched_hist else ""
                    matched_rent: int = cast(int, matched_hist.rent) if (matched_hist and matched_hist.rent) else 0
                    is_jeonse = (str(r.get("lease_type") or "") == "전세") if is_curr else (matched_lease_type == "전세")

                    if is_jeonse:
                        amt = 0
                    elif p.get("paid"):
                        p_rent = p.get("rent_amount")
                        if p_rent is not None:
                            amt = int(p_rent)
                        else:
                            amt = int(r.get("rent") or 0) if is_curr else matched_rent
                    else:
                        if is_curr:
                            amt = int(r.get("rent") or 0)
                        elif matched_hist:
                            amt = matched_rent
                        else:
                            amt = 0

                    if is_curr and r.get("name"):
                        tenant_names_seen.add(str(r.get("name")))
                    elif matched_hist and matched_hist.name:
                        tenant_names_seen.add(str(matched_hist.name))
                    elif p.get("tenant_name"):
                        tenant_names_seen.add(str(p.get("tenant_name")))

                monthly_amounts[m] = amt
                room_period_total += amt

            # 세입자 표시명 산출: 과거 세입자가 납부한 경우 전출자 표기 결합
            curr_name = r.get("name") or "공실"
            if len(tenant_names_seen) > 1:
                other_names = [n for n in tenant_names_seen if n != curr_name]
                display_name = f"{curr_name} (전: {', '.join(other_names)})"
            elif len(tenant_names_seen) == 1:
                only_name = next(iter(tenant_names_seen))
                if only_name != curr_name and curr_name != "공실":
                    display_name = f"{curr_name} (전: {only_name})"
                elif only_name != curr_name and curr_name == "공실":
                    display_name = f"{only_name} (전출)"
                else:
                    display_name = curr_name
            else:
                display_name = curr_name

            # 공급가액 및 부가세(10%) 계산
            supply_val = round(room_period_total / 1.1)
            vat_val = room_period_total - supply_val

            total_collected += room_period_total
            total_supply += supply_val
            total_vat += vat_val

            is_all_paid = all(r.get("payments", {}).get(m, {}).get("paid") for m in months)
            status_text = "완납" if is_all_paid else ("미납" if room_period_total == 0 else "부분완납")

            report_rows.append({
                "room_number": rNum,
                "tenant_name": display_name,
                "id_number": r.get("id_number") or "",
                "lease_type": r.get("lease_type") or "월세",
                "deposit": r.get("deposit") or 0,
                "monthly_amounts": monthly_amounts,
                "period_total": room_period_total,
                "supply_value": supply_val,
                "vat_value": vat_val,
                "status": status_text
            })

        # DB에 저장된 부가세 대상 호실 목록
        saved_settings = cls.get_vat_settings(db, branch_id)
        saved_target_rooms = saved_settings.get("vat_target_rooms")

        return {
            "success": True,
            "branch_id": branch_id,
            "year": year,
            "start_month": start_month,
            "end_month": end_month,
            "months": months,
            "total_collected": total_collected,
            "total_supply": total_supply,
            "total_vat": total_vat,
            "saved_vat_target_rooms": saved_target_rooms,
            "rows": report_rows
        }

    @classmethod
    def generate_excel_bytes(cls, report_data: Dict[str, Any]) -> bytes:
        d = report_data
        months = d.get("months", [])
        rows = d.get("rows", [])

        month_ths = "".join(f'<th style="background:#1e293b;color:#f8fafc;border:1px solid #475569;padding:6px;font-size:11px;">{m}월</th>' for m in months)
        col_span_all = 5 + len(months) + 4

        trs = []
        month_sums = {m: 0 for m in months}
        tot_dep = 0
        tot_period = 0
        tot_supply = 0
        tot_vat = 0

        for r in rows:
            dep = int(r.get("deposit") or 0)
            p_tot = int(r.get("period_total") or 0)
            s_val = int(r.get("supply_value") or 0)
            v_val = int(r.get("vat_value") or 0)
            tot_dep += dep
            tot_period += p_tot
            tot_supply += s_val
            tot_vat += v_val

            month_tds = []
            for m in months:
                amt = int(r.get("monthly_amounts", {}).get(m, 0))
                month_sums[m] += amt
                amt_str = f"{amt:,}" if amt > 0 else "-"
                month_tds.append(f"<td style=\"border:1px solid #cbd5e1;padding:5px;text-align:right;mso-number-format:'\\#\\,\\#\\#0';\">{amt_str}</td>")

            id_num = r.get("id_number") or "-"
            t_name = str(r.get("tenant_name") or "공실").replace('"', '&quot;')
            l_type = r.get("lease_type") or "월세"
            stat = r.get("status") or "완납"
            r_num = r.get("room_number")

            trs.append(f"""<tr>
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;mso-number-format:'\\@';font-weight:bold;">{r_num}호</td>
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:left;">{t_name}</td>
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;mso-number-format:'\\@';">{id_num}</td>
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">{l_type}</td>
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;mso-number-format:'\\#\\,\\#\\#0';">{dep:,}</td>
  {''.join(month_tds)}
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;font-weight:bold;color:#0f766e;mso-number-format:'\\#\\,\\#\\#0';">{p_tot:,}</td>
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;font-weight:bold;color:#1e40af;mso-number-format:'\\#\\,\\#\\#0';">{s_val:,}</td>
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;font-weight:bold;color:#b45309;mso-number-format:'\\#\\,\\#\\#0';">{v_val:,}</td>
  <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">{stat}</td>
</tr>""")

        sum_month_tds = "".join(f"<td style=\"border:1px solid #475569;padding:6px;text-align:right;font-weight:bold;background:#e2e8f0;mso-number-format:'\\#\\,\\#\\#0';\">{month_sums[m]:,}</td>" for m in months)

        html = f"""<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>부가가치세_수납현황</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>
    body {{ font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11px; }}
    table {{ border-collapse: collapse; width: 100%; }}
  </style>
</head>
<body>
  <table>
    <tr>
      <td colspan="{col_span_all}" style="font-size:16px;font-weight:bold;padding:12px;background:#0f172a;color:#ffffff;text-align:center;">
        부동산 임차관리 - 부가가치세 및 기간별 수납현황 ({d.get('year')}년 {d.get('start_month')}월 ~ {d.get('end_month')}월)
      </td>
    </tr>
    <tr>
      <td colspan="{col_span_all}" style="font-size:11px;color:#475569;padding:6px;text-align:right;background:#f8fafc;">
        조회기간: {d.get('year')}년 {d.get('start_month')}월 ~ {d.get('end_month')}월 | 대상: {len(rows)}개실 | 기준: 순수 임차료(월세) 과세표준
      </td>
    </tr>
    <thead>
      <tr style="background:#1e293b;color:#ffffff;">
        <th style="border:1px solid #475569;padding:6px;text-align:center;">호실</th>
        <th style="border:1px solid #475569;padding:6px;text-align:center;">임차인</th>
        <th style="border:1px solid #475569;padding:6px;text-align:center;">주민(사업자)번호</th>
        <th style="border:1px solid #475569;padding:6px;text-align:center;">임대유형</th>
        <th style="border:1px solid #475569;padding:6px;text-align:center;">보증금</th>
        {month_ths}
        <th style="border:1px solid #475569;padding:6px;text-align:center;background:#0f766e;">기간총합계(VAT포함)</th>
        <th style="border:1px solid #475569;padding:6px;text-align:center;background:#1e40af;">공급가액</th>
        <th style="border:1px solid #475569;padding:6px;text-align:center;background:#b45309;">부가가치세(10%)</th>
        <th style="border:1px solid #475569;padding:6px;text-align:center;">수납상태</th>
      </tr>
    </thead>
    <tbody>
      {''.join(trs)}
    </tbody>
    <tfoot>
      <tr style="background:#e2e8f0;font-weight:bold;">
        <td style="border:1px solid #475569;padding:6px;text-align:center;">합계</td>
        <td style="border:1px solid #475569;padding:6px;text-align:left;">총 {len(rows)}개실</td>
        <td style="border:1px solid #475569;padding:6px;text-align:center;">-</td>
        <td style="border:1px solid #475569;padding:6px;text-align:center;">-</td>
        <td style="border:1px solid #475569;padding:6px;text-align:right;mso-number-format:'\\#\\,\\#\\#0';">{tot_dep:,}</td>
        {sum_month_tds}
        <td style="border:1px solid #475569;padding:6px;text-align:right;color:#0f766e;mso-number-format:'\\#\\,\\#\\#0';">{tot_period:,}</td>
        <td style="border:1px solid #475569;padding:6px;text-align:right;color:#1e40af;mso-number-format:'\\#\\,\\#\\#0';">{tot_supply:,}</td>
        <td style="border:1px solid #475569;padding:6px;text-align:right;color:#b45309;mso-number-format:'\\#\\,\\#\\#0';">{tot_vat:,}</td>
        <td style="border:1px solid #475569;padding:6px;text-align:center;">-</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>"""
        return html.encode("utf-8")

    @classmethod
    def generate_csv_bytes(cls, report_data: Dict[str, Any]) -> bytes:
        d = report_data
        months = d.get("months", [])
        rows = d.get("rows", [])

        lines = ["\ufeff"]
        header = ["호실", "임차인", "주민(사업자)번호", "임대유형", "보증금"]
        for m in months:
            header.append(f"{m}월 수납액")
        header.extend(["기간총합계(VAT포함)", "공급가액", "부가가치세", "수납상태"])
        lines.append(",".join(header) + "\n")

        month_sums = {m: 0 for m in months}
        tot_dep = 0
        tot_period = 0
        tot_supply = 0
        tot_vat = 0

        for r in rows:
            dep = int(r.get("deposit") or 0)
            p_tot = int(r.get("period_total") or 0)
            s_val = int(r.get("supply_value") or 0)
            v_val = int(r.get("vat_value") or 0)
            tot_dep += dep
            tot_period += p_tot
            tot_supply += s_val
            tot_vat += v_val

            t_name = str(r.get("tenant_name") or "공실").replace('"', '""')
            id_num = str(r.get("id_number") or "-")
            l_type = str(r.get("lease_type") or "월세")
            stat = str(r.get("status") or "완납")

            row = [
                f'"{r.get("room_number")}호"',
                f'"{t_name}"',
                f'"\t{id_num}"',
                f'"{l_type}"',
                str(dep)
            ]
            for m in months:
                amt = int(r.get("monthly_amounts", {}).get(m, 0))
                month_sums[m] += amt
                row.append(str(amt))
            row.extend([str(p_tot), str(s_val), str(v_val), f'"{stat}"'])
            lines.append(",".join(row) + "\n")

        sum_row = ['"합계"', f'"총 {len(rows)}개실"', '""', '""', str(tot_dep)]
        for m in months:
            sum_row.append(str(month_sums[m]))
        sum_row.extend([str(tot_period), str(tot_supply), str(tot_vat), '""'])
        lines.append(",".join(sum_row) + "\n\n")

        lines.append(f"[보고서 안내],조회기간: {d.get('year')}년 {d.get('start_month')}월 ~ {d.get('end_month')}월 (선택 {len(rows)}개실),,,,,,,,,,\n")
        lines.append(f"[과세표준],공급대가: {tot_period}원 (공급가액: {tot_supply}원 | 부가세: {tot_vat}원),,,,,,,,,,\n")
        lines.append("[산출기준],순수 임차료(월세) 기준 산출 (실비 정산 관리비 및 전세 제외),,,,,,,,,,\n")

        return "".join(lines).encode("utf-8-sig")
