"""
apps/smartfarm/backend/schemas.py
Pydantic schemas matching original chicvill/smartfarm React frontend.
"""
import datetime
from typing import Optional, List
from pydantic import BaseModel


class SensorTelemetry(BaseModel):
    temperature: float = 23.2
    humidity: float = 68.5
    co2_ppm: float = 480.0
    light_lux: float = 12000.0
    soil_moisture: float = 70.0
    ph_level: float = 6.2


class SensorLogResponse(SensorTelemetry):
    id: int = 1
    timestamp: datetime.datetime = datetime.datetime.now()

    class Config:
        from_attributes = True


class ActuatorControlRequest(BaseModel):
    actuator_name: str
    is_on: bool
    mode: str = "MANUAL"


class ActuatorStateResponse(BaseModel):
    id: int = 1
    actuator_name: str
    is_on: bool
    mode: str = "MANUAL"
    updated_at: datetime.datetime = datetime.datetime.now()

    class Config:
        from_attributes = True


class GrowthAnalysisResponse(BaseModel):
    green_pixel_ratio: float = 78.5
    estimated_height_cm: float = 24.3
    growth_rate_pct: float = 12.4
    ai_status_summary: str = "딸기(설향) 생육이 최적 상태입니다. 양분 및 조도가 안정적으로 공급되고 있습니다."
    timestamp: datetime.datetime = datetime.datetime.now()

    class Config:
        from_attributes = True
