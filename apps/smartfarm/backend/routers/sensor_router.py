"""apps/smartfarm/backend/routers/sensor_router.py - 스마트팜 센서 텔레메트리 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid, random

from shared.core.base_database import get_db
from apps.smartfarm.backend.models import Sensor, SensorReading, Farm

router = APIRouter()

SEED_SENSORS = [
    {"name": "온도 센서 1호", "type": "temperature", "unit": "°C", "min": 18.0, "max": 28.0, "current": 24.5},
    {"name": "습도 센서 1호", "type": "humidity", "unit": "%", "min": 50.0, "max": 80.0, "current": 68.2},
    {"name": "CO2 농도 센서", "type": "co2", "unit": "ppm", "min": 400.0, "max": 1200.0, "current": 650.0},
    {"name": "일조량 센서", "type": "light", "unit": "lux", "min": 10000.0, "max": 50000.0, "current": 32400.0},
    {"name": "토양 수분 센서", "type": "soil_moisture", "unit": "%", "min": 30.0, "max": 60.0, "current": 48.7},
]


def _ensure_seed_sensors(db: Session, tenant_id: str):
    count = db.query(Sensor).count()
    if count == 0:
        farm = db.query(Farm).first()
        farm_id = farm.id if farm else str(uuid.uuid4())
        for s in SEED_SENSORS:
            sensor = Sensor(
                id=str(uuid.uuid4()),
                farm_id=farm_id,
                sensor_name=s["name"],
                sensor_type=s["type"],
                unit=s["unit"],
                min_threshold=s["min"],
                max_threshold=s["max"],
                is_active=True,
                location_in_farm="1구역 중앙",
            )
            db.add(sensor)
        db.commit()


@router.get("/latest", summary="실시간 센서 텔레메트리 조회")
async def get_latest_sensor_readings(
    tenant_id: str = "smartfarm-main",
    db: Session = Depends(get_db),
):
    _ensure_seed_sensors(db, tenant_id)
    sensors = db.query(Sensor).filter(Sensor.is_active == True).all()

    readings = []
    for s in sensors:
        # 약간의 실시간 데이터 변동 시뮬레이션
        seed_item = next((item for item in SEED_SENSORS if item["type"] == s.sensor_type), None)
        base_val = seed_item["current"] if seed_item else 20.0
        jitter = random.uniform(-0.3, 0.3)
        val = round(base_val + jitter, 1)

        readings.append({
            "sensor_id": s.id,
            "name": s.sensor_name,
            "type": s.sensor_type,
            "value": val,
            "unit": s.unit,
            "status": "normal" if (s.min_threshold or 0) <= val <= (s.max_threshold or 9999) else "warning",
            "min_threshold": s.min_threshold,
            "max_threshold": s.max_threshold,
        })

    return {
        "tenant_id": tenant_id,
        "timestamp": "실시간",
        "total_sensors": len(readings),
        "readings": readings,
    }


class IngestSensorReadingRequest(BaseModel):
    sensor_id: str
    farm_id: Optional[str] = "farm-1"
    value: float


@router.post("/readings", summary="센서 데이터 수집(Ingest)")
async def ingest_reading(
    body: IngestSensorReadingRequest,
    db: Session = Depends(get_db),
):
    reading = SensorReading(
        id=str(uuid.uuid4()),
        sensor_id=body.sensor_id,
        farm_id=body.farm_id,
        value=body.value,
        is_alert=False,
    )
    db.add(reading)
    db.commit()
    return {"success": True, "reading_id": reading.id, "value": body.value}
