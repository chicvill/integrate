import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.db import models
from backend.schemas import SeatResponse, SeatAssign

router = APIRouter(prefix="/api/seats", tags=["Seats"])

@router.get("/", response_model=list[SeatResponse])
def get_all_seats(db: Session = Depends(get_db)):
    seats = db.query(models.Seat).all()
    # Seed default 20 seats if empty
    if not seats:
        for i in range(1, 21):
            s = models.Seat(seat_number=f"A-{i:02d}", zone_type="NORMAL", status="EMPTY")
            db.add(s)
        db.commit()
        seats = db.query(models.Seat).all()
    
    response_list = []
    for s in seats:
        seat_dict = {
            "id": s.id,
            "seat_number": s.seat_number,
            "zone_type": s.zone_type,
            "status": s.status,
            "current_user_id": s.current_user_id,
            "current_user_name": s.current_user.name if s.current_user else None,
            "current_user_type": s.current_user.user_type if s.current_user else None,
            "current_user_phone": s.current_user.phone if s.current_user else None,
            "occupied_since": s.occupied_since
        }
        response_list.append(SeatResponse(**seat_dict))
    return response_list

@router.post("/assign", response_model=SeatResponse)
def assign_seat(payload: SeatAssign, db: Session = Depends(get_db)):
    seat = db.query(models.Seat).filter(models.Seat.seat_number == payload.seat_number).first()
    if not seat:
        raise HTTPException(status_code=404, detail="좌석을 찾을 수 없습니다.")
    
    if seat.status == "OCCUPIED" and seat.current_user_id != payload.user_id:
        raise HTTPException(status_code=400, detail="이미 다른 사용자가 이용 중인 좌석입니다.")
    
    seat.status = "OCCUPIED"
    seat.current_user_id = payload.user_id
    seat.occupied_since = datetime.datetime.utcnow()
    db.commit()
    db.refresh(seat)
    return seat

@router.post("/leave/{seat_number}", response_model=SeatResponse)
def checkout_seat(seat_number: str, db: Session = Depends(get_db)):
    seat = db.query(models.Seat).filter(models.Seat.seat_number == seat_number).first()
    if not seat:
        raise HTTPException(status_code=404, detail="좌석을 찾을 수 없습니다.")
    
    seat.status = "EMPTY"
    seat.current_user_id = None
    seat.occupied_since = None
    db.commit()
    db.refresh(seat)
    return seat
