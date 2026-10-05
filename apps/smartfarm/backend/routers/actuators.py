"""
apps/smartfarm/backend/routers/actuators.py
Actuators router for SmartFarm remote control.
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from apps.smartfarm.backend.db.database import get_db
from apps.smartfarm.backend.db import models
from apps.smartfarm.backend.schemas import ActuatorControlRequest, ActuatorStateResponse

router = APIRouter(tags=["SmartFarm Actuators"])

# Default in-memory state
actuator_states = [
    {"id": 1, "actuator_name": "환풍팬 (Ventilation Fan)", "is_on": True, "mode": "AUTO", "updated_at": datetime.datetime.now()},
    {"id": 2, "actuator_name": "관수 펌프 (Water Pump)", "is_on": False, "mode": "MANUAL", "updated_at": datetime.datetime.now()},
    {"id": 3, "actuator_name": "LED 보광등 (Grow Light)", "is_on": True, "mode": "AUTO", "updated_at": datetime.datetime.now()},
    {"id": 4, "actuator_name": "온풍 히터 (PTC Heater)", "is_on": False, "mode": "AUTO", "updated_at": datetime.datetime.now()},
]


@router.get("/", response_model=List[ActuatorStateResponse])
@router.get("", response_model=List[ActuatorStateResponse])
def list_actuators():
    return actuator_states


@router.post("/control", response_model=ActuatorStateResponse)
@router.post("/toggle")
def control_actuator(payload: ActuatorControlRequest, db: Session = Depends(get_db)):
    for item in actuator_states:
        if item["actuator_name"] == payload.actuator_name or payload.actuator_name in item["actuator_name"]:
            item["is_on"] = payload.is_on
            item["mode"] = payload.mode
            item["updated_at"] = datetime.datetime.now()
            
            # Log in DB
            log = models.ActuatorLog(
                device_name=payload.actuator_name,
                status="ON" if payload.is_on else "OFF",
                trigger_type=payload.mode
            )
            db.add(log)
            db.commit()
            return item

    # If not in list, add dynamically
    new_item = {
        "id": len(actuator_states) + 1,
        "actuator_name": payload.actuator_name,
        "is_on": payload.is_on,
        "mode": payload.mode,
        "updated_at": datetime.datetime.now()
    }
    actuator_states.append(new_item)
    return new_item
