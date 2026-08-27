"""스터디카페 좌석 관리 라우터"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from shared.core.base_database import get_db
from shared.auth.router import get_current_user_dependency
from shared.auth.models import User
from apps.studycafe.backend.models import Seat

router = APIRouter()


@router.get("/", summary="전체 좌석 현황 조회")
async def get_all_seats(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency),
):
    """해당 스터디카페의 전체 좌석 현황을 반환합니다."""
    seats = db.query(Seat).filter(Seat.tenant_id == tenant_id).all()
    return {
        "total": len(seats),
        "occupied": sum(1 for s in seats if s.is_occupied),
        "available": sum(1 for s in seats if not s.is_occupied and s.is_available),
        "seats": [{"id": s.id, "seat_number": s.seat_number, "type": s.seat_type,
                   "is_occupied": s.is_occupied, "is_available": s.is_available} for s in seats],
    }


@router.post("/{seat_id}/check-in", summary="좌석 입실")
async def check_in(
    seat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency),
):
    """해당 좌석에 입실 처리합니다."""
    from fastapi import HTTPException
    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="좌석을 찾을 수 없습니다.")
    if seat.is_occupied:
        raise HTTPException(status_code=409, detail="이미 사용 중인 좌석입니다.")
    seat.is_occupied = True
    seat.current_user_id = current_user.id
    db.commit()
    return {"message": f"{seat.seat_number}번 좌석 입실 완료", "seat_id": seat_id}
