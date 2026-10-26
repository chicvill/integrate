"""
apps/laundry/backend/api.py — HTTP ↔ 도메인 변환만 담당하는 얇은 라우터.

try/except 가 없는 이유: 도메인 객체가 DomainError 를 던지면
게이트웨이가 알림 배너 규격 JSON 으로 자동 변환한다.
"""
from typing import Any, Dict

from fastapi import APIRouter, Body, Depends

from core import DomainError, require_role

from . import domain
from .domain import COURSES, Machine, Payment

router = APIRouter()
admin_only = [Depends(require_role("superadmin", "admin"))]


def _amount(value: Any) -> int:
    try:
        n = int(str(value if value not in (None, "") else 0).replace(",", ""))
    except ValueError:
        raise DomainError(f"투입 금액 '{value}'을(를) 숫자로 인식할 수 없습니다.", hint="숫자만 입력해 주세요 (예: 4000).")
    if n < 0:
        raise DomainError("투입 금액은 0원 이상이어야 합니다.")
    return n


@router.get("/status")
def status(branch_id: str = "main") -> Dict[str, Any]:
    return {"success": True, "app_id": "laundry", **domain.branch_stats(branch_id)}


@router.get("/courses")
def courses() -> Dict[str, Any]:
    return {"success": True, "courses": COURSES}


@router.get("/machines")
def machines(branch_id: str = "main") -> Dict[str, Any]:
    return {"success": True, "machines": [m.card() for m in Machine.board(branch_id)]}


@router.post("/machines/{machine_no}/start")
def start(machine_no: str, payload: Dict[str, Any] = Body(...), branch_id: str = "main") -> Dict[str, Any]:
    m = Machine.by_no(machine_no, branch_id)
    payment = m.start(str(payload.get("course", "")), _amount(payload.get("paid")), str(payload.get("phone", "")).strip())
    return {"success": True, "message": f"{m.machine_no} {m.course_name} 시작! 약 {m.remaining_minutes}분 후 완료됩니다.",
            "machine": m.card(), "payment": payment.card()}


@router.post("/machines/{machine_no}/collect")
def collect(machine_no: str, branch_id: str = "main") -> Dict[str, Any]:
    m = Machine.by_no(machine_no, branch_id)
    m.collect()
    return {"success": True, "message": f"{m.machine_no} 수거 완료. 다음 고객이 이용할 수 있습니다.", "machine": m.card()}


@router.post("/machines/{machine_no}/broken", dependencies=admin_only)
def broken(machine_no: str, payload: Dict[str, Any] = Body(default={}), branch_id: str = "main") -> Dict[str, Any]:
    m = Machine.by_no(machine_no, branch_id)
    m.report_broken(str(payload.get("reason", "")))
    return {"success": True, "message": f"{m.machine_no} 점검 중으로 전환했습니다.", "machine": m.card()}


@router.post("/machines/{machine_no}/repair", dependencies=admin_only)
def repair(machine_no: str, branch_id: str = "main") -> Dict[str, Any]:
    m = Machine.by_no(machine_no, branch_id)
    m.repair()
    return {"success": True, "message": f"{m.machine_no} 점검 완료 → 사용 가능.", "machine": m.card()}


@router.get("/payments")
def payments(branch_id: str = "main", limit: int = 30) -> Dict[str, Any]:
    rows = sorted(Payment.find(branch_id), key=lambda p: p.paid_at, reverse=True)[: max(1, min(limit, 200))]
    return {"success": True, "payments": [p.card() for p in rows]}
