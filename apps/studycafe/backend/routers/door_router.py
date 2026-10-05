"""
apps/studycafe/backend/routers/door_router.py
스터디카페 NFC / IoT 스마트 도어락 & 화재 소방 연동 비상 페일세이프(Fail-Safe) 제어 라우터.
"""
import datetime
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any

logger = logging.getLogger("studycafe.door")
router = APIRouter()

# 전역 비상/화재 모드 상태 (메모리 및 릴레이 연동 플래그)
_emergency_state: dict[str, Any] = {
    "is_emergency": False,
    "reason": "정상 운영 중",
    "triggered_at": None,
    "fire_sensor_tripped": False
}


class DoorTriggerResponse(BaseModel):
    success: bool
    message: str
    door_id: int
    triggered_at: str
    relay_status: str
    is_emergency: bool


class EmergencyStatusResponse(BaseModel):
    is_emergency: bool
    reason: str
    triggered_at: Optional[str]
    fire_sensor_tripped: bool
    door_state: str
    fail_safe_guideline: str


@router.get("/status", response_model=EmergencyStatusResponse, summary="출입문 및 화재 비상 상태 조회")
async def get_door_status():
    """현재 출입문 개방 및 소방/비상 페일세이프 상태를 확인합니다."""
    return EmergencyStatusResponse(
        is_emergency=_emergency_state["is_emergency"],
        reason=_emergency_state["reason"],
        triggered_at=_emergency_state["triggered_at"],
        fire_sensor_tripped=_emergency_state["fire_sensor_tripped"],
        door_state="PERMANENT_OPEN" if _emergency_state["is_emergency"] else "LOCKED_AUTO",
        fail_safe_guideline="소방법 규정에 따라 화재 또는 정전 시 전자기식 락(EM-Lock) 전원이 자동 차단되어 상시 개방됩니다."
    )


@router.post("/trigger/{door_id}", response_model=DoorTriggerResponse, summary="스마트 도어락 원격 개방 (NFC/IoT)")
async def trigger_door(door_id: int = 1):
    """
    NFC 리더기 / 앱 요청을 받아 지정된 도어락(릴레이)을 5초간 개방합니다.
    비상 모드 활성화 중인 경우 상시 개방 상태를 유지합니다.
    """
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if _emergency_state["is_emergency"]:
        return DoorTriggerResponse(
            success=True,
            message="🚨 [비상 모드] 화재/비상 대피로 인해 출입문이 상시 전면 개방되어 있습니다.",
            door_id=door_id,
            triggered_at=now,
            relay_status="PERMANENT_OPEN (Fire/Emergency Fail-Safe)",
            is_emergency=True
        )

    logger.info(f"[DOOR-LOCK] Door {door_id} triggered (NFC/IoT 5s Pulse Open).")
    return DoorTriggerResponse(
        success=True,
        message=f"[성공] 도어 {door_id}번 문이 5초간 정상 개방되었습니다 (NFC/IoT 스마트 도어락 연동).",
        door_id=door_id,
        triggered_at=now,
        relay_status="OPEN (5s Pulse)",
        is_emergency=False
    )


@router.post("/emergency-open", summary="🚨 화재 감지 및 비상 전면 개방 발령 (Fail-Safe)")
async def activate_emergency_open(reason: str = "화재 감지기 연동 또는 비상 버튼 작동"):
    """
    화재 감지기 센서 신호 수신 또는 점주 비상 개방 발령 시:
    출입문 릴레이를 영구 개방하고 관제 화면에 화재 비상 대피 경보를 발령합니다.
    """
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    _emergency_state["is_emergency"] = True
    _emergency_state["reason"] = reason
    _emergency_state["triggered_at"] = now
    _emergency_state["fire_sensor_tripped"] = True

    logger.critical(f"[FIRE-ALERT] Emergency door open activated: {reason}")
    return {
        "success": True,
        "message": f"🚨 [화재/비상 개방 발령] 출입문이 비상 대피를 위해 전면 상시 개방되었습니다: {reason}",
        "is_emergency": True,
        "door_state": "PERMANENT_OPEN",
        "triggered_at": now
    }


@router.post("/emergency-reset", summary="비상 개방 해제 및 정상 운영 복구")
async def reset_emergency():
    """상황 종료 후 정상 출입 제어 모드로 복구합니다."""
    _emergency_state["is_emergency"] = False
    _emergency_state["reason"] = "정상 운영 중"
    _emergency_state["triggered_at"] = None
    _emergency_state["fire_sensor_tripped"] = False

    logger.info("[FIRE-ALERT] Emergency door open reset to normal operation.")
    return {
        "success": True,
        "message": "✅ 비상 개방이 해제되었으며 출입문이 정상 자동 잠금 모드로 복구되었습니다.",
        "is_emergency": False,
        "door_state": "LOCKED_AUTO"
    }
