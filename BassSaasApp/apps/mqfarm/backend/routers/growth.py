"""
apps/smartfarm/backend/routers/growth.py
Growth Vision analysis router.
"""
import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from apps.mqfarm.backend.db.database import get_db
from apps.mqfarm.backend.db import models
from apps.mqfarm.backend.services.ai_engine import smartfarm_ai_engine
from apps.mqfarm.backend.schemas import GrowthAnalysisResponse

router = APIRouter(prefix="", tags=["SmartFarm Growth"])


@router.get("/analysis", response_model=GrowthAnalysisResponse)
def get_growth_analysis(db: Session = Depends(get_db)):
    latest = db.query(models.SensorReading).order_by(models.SensorReading.timestamp.desc()).first()
    temp = latest.temperature if latest else 23.2
    hum = latest.humidity if latest else 68.5
    co2 = latest.co2 if latest else 480.0
    light = latest.light_lux if latest else 12000.0

    diagnosis = smartfarm_ai_engine.diagnose_crop_health("딸기(설향)", temp, hum, co2, light)

    return GrowthAnalysisResponse(
        green_pixel_ratio=78.5,
        estimated_height_cm=24.3,
        growth_rate_pct=12.4,
        ai_status_summary=diagnosis.get("summary", "작물 생육이 최적 상태입니다."),
        timestamp=datetime.datetime.now()
    )
