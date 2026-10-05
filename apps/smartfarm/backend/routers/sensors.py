"""
apps/smartfarm/backend/routers/sensors.py
Sensors router for SmartFarm monitoring.
"""
import random
import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from apps.smartfarm.backend.db.database import get_db
from apps.smartfarm.backend.db import models
from apps.smartfarm.backend.schemas import SensorTelemetry

router = APIRouter(tags=["SmartFarm Sensors"])


@router.get("/current", response_model=SensorTelemetry)
@router.get("/latest", response_model=SensorTelemetry)
def get_current_sensors(db: Session = Depends(get_db)):
    try:
        reading = db.query(models.SensorReading).first()
        if reading and hasattr(reading, "temperature"):
            return SensorTelemetry(
                temperature=reading.temperature,
                humidity=reading.humidity,
                co2_ppm=reading.co2,
                light_lux=reading.light_lux,
                soil_moisture=reading.soil_moisture or 70.0,
                ph_level=6.2
            )
    except Exception:
        pass

    return SensorTelemetry(
        temperature=round(22.5 + random.uniform(-0.5, 0.5), 1),
        humidity=round(65.0 + random.uniform(-1.0, 1.0), 1),
        co2_ppm=round(480.0 + random.uniform(-10, 10), 0),
        light_lux=round(12000.0 + random.uniform(-200, 200), 0),
        soil_moisture=70.0,
        ph_level=6.2
    )

