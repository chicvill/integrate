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

            for m in months:
                p = r.get("payments", {}).get(m, {})
                if p.get("paid"):
                    amt = (p.get("rent_amount") or 0) + (p.get("maintenance_amount") or 0)
                    t_name = p.get("tenant_name")
                    if t_name:
                        tenant_names_seen.add(t_name)
                else:
                    amt = 0
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
