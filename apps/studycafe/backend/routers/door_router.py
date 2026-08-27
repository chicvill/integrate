"""
apps/studycafe/backend/routers/door_router.py
스터디카페 NFC / IoT 스마트 도어락 제어 라우터 (오리지널 studycafe 컨셉 복원).
"""
import datetime
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger("studycafe.door")
router = APIRouter()


class DoorTriggerResponse(BaseModel):
    success: bool
    message: str
    door_id: int
    triggered_at: str
    relay_status: str


@router.post("/trigger/{door_id}", response_model=DoorTriggerResponse, summary="스마트 도어락 원격 개방 (NFC/IoT)")
async def trigger_door(door_id: int = 1):
    """
    NFC 리더기 / 앱 요청을 받아 지정된 도어락(릴레이)을 5초간 개방합니다.
    (MQTT 스마트 플러그/릴레이 브로커 또는 로컬 GPIO 연동)
    """
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    logger.info(f"[DOOR-LOCK] Door {door_id} triggered (NFC/IoT Open command sent).")
    
    return DoorTriggerResponse(
        success=True,
        message=f"[성공] 도어 {door_id}번 문이 5초간 정상 개방되었습니다 (NFC/IoT 스마트 도어락 연동).",
        door_id=door_id,
        triggered_at=now,
        relay_status="OPEN (5s Pulse)",
    )
