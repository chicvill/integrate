"""
apps/rent2/backend/routers/tax.py
부가가치세 1기/2기 신고 리포트 (엑셀/CSV 다운로드), 부가세 대상 호실 설정, 종합소득세 필요경비 집계
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query

from ..domain import vat
from ..domain.rent import num
from ..kernel.identity import User
from .common import file_response, get_building, me, parse_rooms_csv

router = APIRouter()


@router.get("/vat-report")
def vat_report(
    branch_id: str = "main",
    start_month: int = Query(1, ge=1, le=12),
    end_month: int = Query(6, ge=1, le=12),
    year: Optional[int] = None,
    room_numbers: Optional[str] = None,
    user: User = Depends(me)
):
    if start_month > end_month:
        raise HTTPException(400, "시작월은 종료월보다 클 수 없습니다.")
    return vat.report(get_building(branch_id, user), start_month, end_month, year, parse_rooms_csv(room_numbers))


@router.get("/vat-report/download")
def vat_download(
    branch_id: str = "main",
    start_month: int = Query(1, ge=1, le=12),
    end_month: int = Query(6, ge=1, le=12),
    year: Optional[int] = None,
    format_type: str = Query("excel", pattern="^(excel|csv)$"),
    room_numbers: Optional[str] = None,
    user: User = Depends(me)
):
    if start_month > end_month:
        raise HTTPException(400, "시작월은 종료월보다 클 수 없습니다.")
    d = vat.report(get_building(branch_id, user), start_month, end_month, year, parse_rooms_csv(room_numbers))
    stem = f"부동산_부가세_수납현황_{d['year']}년_{start_month}월_{end_month}월"
    is_csv = format_type == "csv"
    return file_response(
        vat.csv_bytes(d) if is_csv else vat.excel_bytes(d),
        "text/csv; charset=utf-8" if is_csv else "application/vnd.ms-excel; charset=utf-8",
        stem + (".csv" if is_csv else ".xls")
    )


@router.get("/vat-settings")
def get_vat_settings(branch_id: str = "main", user: User = Depends(me)):
    b = get_building(branch_id, user)
    return {"success": True, "branch_id": b.id, "vat_target_rooms": b.vat_target_rooms}


@router.post("/vat-settings")
def save_vat_settings(p: Dict[str, Any] = Body(...), user: User = Depends(me)):
    b = get_building(p.get("branch_id"), user)
    b.vat_target_rooms = sorted(set(num(r) for r in p.get("vat_target_rooms") or []))
    b.save("vat_settings")
    return {
        "success": True,
        "branch_id": b.id,
        "vat_target_rooms": b.vat_target_rooms,
        "message": f"부가세 대상 호실 {len(b.vat_target_rooms)}개실 설정이 영구 저장되었습니다."
    }


# ── 종합소득세 보고서 ──
@router.get("/tax/income-tax")
def get_income_tax_report(branch_id: str = "main", year: Optional[int] = None, user: User = Depends(me)):
    b = get_building(branch_id, user)
    return vat.income_tax_report(b, year)


@router.get("/tax/income-tax/excel")
def download_income_tax_excel(branch_id: str = "main", year: Optional[int] = None, user: User = Depends(me)):
    b = get_building(branch_id, user)
    rep = vat.income_tax_report(b, year)
    y = rep["year"]
    return file_response(vat.income_tax_excel_bytes(rep), "application/vnd.ms-excel", f"{b.name}_종합소득세_{y}년.xls")


@router.get("/tax/income-tax/csv")
def download_income_tax_csv(branch_id: str = "main", year: Optional[int] = None, user: User = Depends(me)):
    b = get_building(branch_id, user)
    rep = vat.income_tax_report(b, year)
    y = rep["year"]
    return file_response(vat.income_tax_csv_bytes(rep), "text/csv; charset=utf-8", f"{b.name}_종합소득세_{y}년.csv")
