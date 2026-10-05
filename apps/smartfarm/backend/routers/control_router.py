"""apps/smartfarm/backend/routers/control_router.py - 스마트팜 원격 제어 및 AI 진단 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid, datetime

from shared.core.base_database import get_db
from apps.smartfarm.backend.models import ControlDevice, Sensor, Farm
from apps.smartfarm.backend.config import get_settings
from apps.smartfarm.backend.db.smartfarm_ai_service import SmartFarmAIService

router = APIRouter()

SEED_DEVICES = [
    {"name": "스마트 환풍팬 1호", "type": "fan", "is_on": False, "auto": True},
    {"name": "자동 급수/양액 밸브", "type": "irrigation", "is_on": True, "auto": True},
    {"name": "식물생장용 LED 조명", "type": "lighting", "is_on": True, "auto": False},
    {"name": "온실 온풍 난방기", "type": "heater", "is_on": False, "auto": True},
]


def _ensure_seed_devices(db: Session, tenant_id: str):
    count = db.query(ControlDevice).count()
    if count == 0:
        farm = db.query(Farm).first()
        farm_id = farm.id if farm else str(uuid.uuid4())
        for d in SEED_DEVICES:
            dev = ControlDevice(
                id=str(uuid.uuid4()),
                farm_id=farm_id,
                device_name=d["name"],
                device_type=d["type"],
                is_on=d["is_on"],
                auto_mode=d["auto"],
            )
            db.add(dev)
        db.commit()


@router.get("/", summary="제어 장치 목록 및 상태 조회")
async def list_control_devices(
    tenant_id: str = "smartfarm-main",
    db: Session = Depends(get_db),
):
    _ensure_seed_devices(db, tenant_id)
    devices = db.query(ControlDevice).all()
    return {
        "tenant_id": tenant_id,
        "total": len(devices),
        "devices": [
            {
                "id": d.id,
                "name": d.device_name,
                "type": d.device_type,
                "is_on": d.is_on,
                "auto_mode": d.auto_mode,
                "last_controlled_at": d.last_controlled_at.isoformat() if d.last_controlled_at else None,
            }
            for d in devices
        ]
    }


class ToggleDeviceRequest(BaseModel):
    is_on: Optional[bool] = None
    auto_mode: Optional[bool] = None


@router.post("/{device_id}/toggle", summary="장치 On/Off 원격 제어")
async def toggle_device(
    device_id: str,
    body: ToggleDeviceRequest,
    db: Session = Depends(get_db),
):
    dev = db.query(ControlDevice).filter(
        (ControlDevice.id == device_id) | (ControlDevice.device_name == device_id) | (ControlDevice.device_type == device_id)
    ).first()
    if not dev:
        raise HTTPException(status_code=404, detail="제어 장치를 찾을 수 없습니다.")

    if body.is_on is not None:
        dev.is_on = body.is_on
    else:
        dev.is_on = not dev.is_on

    if body.auto_mode is not None:
        dev.auto_mode = body.auto_mode

    dev.last_controlled_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    state_str = "ON (가동)" if dev.is_on else "OFF (정지)"
    return {
        "success": True,
        "message": f"[{dev.device_name}] 장치가 {state_str} 상태로 변경되었습니다.",
        "device_id": dev.id,
        "is_on": dev.is_on,
        "auto_mode": dev.auto_mode,
    }


@router.post("/ai-diagnose", summary="Gemini AI 실시간 온실 환경 이상 진단")
async def run_ai_diagnosis(
    crop_name: Optional[str] = "딸기(설향)",
    tenant_id: str = "smartfarm-main",
    db: Session = Depends(get_db),
):
    sensors = db.query(Sensor).filter(Sensor.is_active == True).all()
    telemetry = [{"sensor": s.sensor_name, "type": s.sensor_type, "unit": s.unit} for s in sensors]

    settings = get_settings()
    service = SmartFarmAIService(api_key=settings.GEMINI_API_KEY)
    diagnosis = await service.diagnose_environment(telemetry, crop_name=crop_name)

    return {
        "crop_name": crop_name,
        "ai_diagnosis": diagnosis,
    }
