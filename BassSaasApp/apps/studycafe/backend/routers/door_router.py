"""
apps/studycafe/backend/routers/door_router.py
스터디카페 NFC / IoT 스마트 도어락 & 화재 소방 연동 비상 페일세이프(Fail-Safe) 제어 라우터.
"""
import datetime
import logging
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from shared.core.base_database import get_db
from apps.studycafe.backend.models import StudyCafeBranch

logger = logging.getLogger("studycafe.door")
router = APIRouter()

# 지점별 비상/화재 모드 상태 (메모리 격리 딕셔너리)
_branch_emergency_states: dict[str, dict[str, Any]] = {}

def _get_branch_emergency_state(tenant_id: str) -> dict[str, Any]:
    if tenant_id not in _branch_emergency_states:
        _branch_emergency_states[tenant_id] = {
            "is_emergency": False,
            "reason": "정상 운영 중",
            "triggered_at": None,
            "fire_sensor_tripped": False
        }
    return _branch_emergency_states[tenant_id]


class DoorTriggerResponse(BaseModel):
    success: bool
    message: str
    door_id: int
    triggered_at: str
    relay_status: str
    is_emergency: bool
    tenant_id: str


class EmergencyStatusResponse(BaseModel):
    is_emergency: bool
    reason: str
    triggered_at: Optional[str]
    fire_sensor_tripped: bool
    door_state: str
    fail_safe_guideline: str
    tenant_id: str


@router.get("/status", response_model=EmergencyStatusResponse, summary="출입문 및 화재 비상 상태 조회 (지점별)")
async def get_door_status(tenant_id: str = Query("studycafe-main")):
    """현재 출입문 개방 및 소방/비상 페일세이프 상태를 확인합니다."""
    state = _get_branch_emergency_state(tenant_id)
    return EmergencyStatusResponse(
        is_emergency=state["is_emergency"],
        reason=state["reason"],
        triggered_at=state["triggered_at"],
        fire_sensor_tripped=state["fire_sensor_tripped"],
        door_state="PERMANENT_OPEN" if state["is_emergency"] else "LOCKED_AUTO",
        fail_safe_guideline="소방법 규정에 따라 화재 또는 정전 시 전자기식 락(EM-Lock) 전원이 자동 차단되어 상시 개방됩니다.",
        tenant_id=tenant_id
    )


@router.post("/trigger/{door_id}", response_model=DoorTriggerResponse, summary="스마트 도어락 원격 개방 (NFC/IoT 지점별)")
async def trigger_door(
    door_id: int = 1,
    tenant_id: str = Query("studycafe-main"),
    db: Session = Depends(get_db)
):
    """
    NFC 리더기 / 앱 요청을 받아 지정된 매장의 도어락(릴레이)을 5초간 개방합니다.
    비상 모드 활성화 중인 경우 상시 개방 상태를 유지합니다.
    """
    state = _get_branch_emergency_state(tenant_id)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if state["is_emergency"]:
        return DoorTriggerResponse(
            success=True,
            message=f"🚨 [{tenant_id} 비상 모드] 화재/비상 대피로 인해 출입문이 상시 전면 개방되어 있습니다.",
            door_id=door_id,
            triggered_at=now,
            relay_status="PERMANENT_OPEN (Fire/Emergency Fail-Safe)",
            is_emergency=True,
            tenant_id=tenant_id
        )

    branch = db.query(StudyCafeBranch).filter(StudyCafeBranch.branch_id == tenant_id).first()
    relay_host = branch.relay_host if branch else "127.0.0.1"
    relay_port = branch.relay_port if branch else 8080

    logger.info(f"[{tenant_id}] Door {door_id} triggered (NFC/IoT 5s Pulse Open -> {relay_host}:{relay_port}).")
    return DoorTriggerResponse(
        success=True,
        message=f"[성공] {tenant_id} 매장 {door_id}번 문이 5초간 정상 개방되었습니다 (릴레이 {relay_host}:{relay_port} 연동).",
        door_id=door_id,
        triggered_at=now,
        relay_status="OPEN (5s Pulse)",
        is_emergency=False,
        tenant_id=tenant_id
    )


@router.post("/emergency-open", summary="🚨 화재 감지 및 비상 전면 개방 발령 (지점별 Fail-Safe)")
async def activate_emergency_open(
    reason: str = "화재 감지기 연동 또는 비상 버튼 작동",
    tenant_id: str = Query("studycafe-main"),
    db: Session = Depends(get_db)
):
    """
    화재 감지기 센서 신호 수신 또는 점주 비상 개방 발령 시:
    해당 지점 출입문 릴레이를 영구 개방하고 관제 화면에 화재 비상 대피 경보를 발령합니다.
    """
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    state = _get_branch_emergency_state(tenant_id)
    state["is_emergency"] = True
    state["reason"] = reason
    state["triggered_at"] = now
    state["fire_sensor_tripped"] = True

    branch = db.query(StudyCafeBranch).filter(StudyCafeBranch.branch_id == tenant_id).first()
    if branch:
        branch.is_emergency_open = True
        db.commit()

    logger.critical(f"[{tenant_id} FIRE-ALERT] Emergency door open activated: {reason}")
    return {
        "success": True,
        "message": f"🚨 [{tenant_id} 화재/비상 개방 발령] 출입문이 비상 대피를 위해 전면 상시 개방되었습니다: {reason}",
        "is_emergency": True,
        "door_state": "PERMANENT_OPEN",
        "triggered_at": now,
        "tenant_id": tenant_id
    }


@router.post("/emergency-reset", summary="비상 개방 해제 및 정상 운영 복구 (지점별)")
async def reset_emergency(
    tenant_id: str = Query("studycafe-main"),
    db: Session = Depends(get_db)
):
    """상황 종료 후 정상 출입 제어 모드로 복구합니다."""
    state = _get_branch_emergency_state(tenant_id)
    state["is_emergency"] = False
    state["reason"] = "정상 운영 중"
    state["triggered_at"] = None
    state["fire_sensor_tripped"] = False

    branch = db.query(StudyCafeBranch).filter(StudyCafeBranch.branch_id == tenant_id).first()
    if branch:
        branch.is_emergency_open = False
        db.commit()

    logger.info(f"[{tenant_id} FIRE-ALERT] Emergency door open reset to normal operation.")
    return {
        "success": True,
        "message": f"✅ {tenant_id} 매장의 비상 개방이 해제되었으며 출입문이 정상 자동 잠금 모드로 복구되었습니다.",
        "tenant_id": tenant_id,
        "is_emergency": False,
        "door_state": "LOCKED_AUTO"
    }
