from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.db import models
from backend.services.mqtt_helper import mqtt_helper

router = APIRouter(prefix="/api/door", tags=["NFC Door Access"])

@router.post("/trigger/{user_id}")
def open_door_by_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    user_name = user.name if user else f"User#{user_id}"

    success = mqtt_helper.trigger_door_open(user_name=user_name)
    
    log = models.DoorLog(user_id=user_id, action="ENTRY" if success else "DENIED")
    db.add(log)
    db.commit()

    return {"status": "SUCCESS" if success else "FAILED", "message": f"{user_name} 출입문 개폐 명령이 전송되었습니다."}
