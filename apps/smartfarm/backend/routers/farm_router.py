"""apps/smartfarm/backend/routers/farm_router.py - 스마트팜 농장 관리 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid

from shared.core.base_database import get_db
from apps.smartfarm.backend.models import Farm

router = APIRouter()


def _ensure_seed_farms(db: Session, tenant_id: str):
    count = db.query(Farm).filter(Farm.tenant_id == tenant_id).count()
    if count == 0:
        farm = Farm(
            id=str(uuid.uuid4()),
            owner_id="demo-farmer",
            tenant_id=tenant_id,
            farm_name="MQnet 스마트 스마트온실 1호",
            location="충청남도 부여군 스마트팜 테크노밸리 A구역",
            farm_type="greenhouse",
            crop_types=["딸기(설향)", "파프리카"],
            total_area_sqm=1250.0,
            is_active=True,
        )
        db.add(farm)
        db.commit()


@router.get("/", summary="농장 목록 조회")
async def list_farms(
    tenant_id: str = "smartfarm-main",
    db: Session = Depends(get_db),
):
    _ensure_seed_farms(db, tenant_id)
    farms = db.query(Farm).filter(Farm.tenant_id == tenant_id).all()
    return {
        "tenant_id": tenant_id,
        "total": len(farms),
        "farms": [
            {
                "id": f.id,
                "farm_name": f.farm_name,
                "farm_type": f.farm_type,
                "location": f.location,
                "crop_types": f.crop_types,
                "total_area_sqm": f.total_area_sqm,
                "is_active": f.is_active,
            }
            for f in farms
        ]
    }
