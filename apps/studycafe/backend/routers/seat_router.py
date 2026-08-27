"""
apps/studycafe/backend/routers/seat_router.py
스터디카페 좌석 배정 및 퇴실 라우터 (오리지널 studycafe 컨셉 100% 복원).
- 좌석: A-01 ~ A-20
- 구역: FOCUS (포커스존), NORMAL (일반존), LAPTOP (노트북존)
- 회원: GENERAL (일반회원), MANAGED (관리형회원)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import datetime

from shared.core.base_database import get_db
from apps.studycafe.backend.models import Seat, StudyCafeUser, StudyCafeSession
from apps.studycafe.backend.config import get_settings
from apps.studycafe.backend.db.studycafe_ai_service import StudyCafeAIService

router = APIRouter()


class SeatAssignRequest(BaseModel):
    seat_number: str
    phone: str
    name: str
    user_type: Optional[str] = "GENERAL"  # 'GENERAL' | 'MANAGED'
    user_id: Optional[str] = None


def _ensure_original_20_seats(db: Session, tenant_id: str = "studycafe-main"):
    """오리지널 studycafe 20개 구역별 좌석(A-01 ~ A-20) 시딩"""
    seats = db.query(Seat).filter(Seat.tenant_id == tenant_id).all()
    
    # 만약 좌석이 없거나 구버전(1~16번)이면 20개 좌석(A-01~A-20)으로 갱신
    if len(seats) < 20 or (seats and not seats[0].seat_number.startswith("A-")):
        # 기존 임시 좌석 삭제 후 20개 신규 생성
        db.query(Seat).filter(Seat.tenant_id == tenant_id).delete()
        db.commit()

        for i in range(1, 21):
            s_num = f"A-{i:02d}"
            if 1 <= i <= 8:
                zone = "FOCUS"
            elif 9 <= i <= 16:
                zone = "NORMAL"
            else:
                zone = "LAPTOP"

            seat = Seat(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                seat_number=s_num,
                zone_type=zone,
                seat_type=zone.lower(),
                status="EMPTY",
                is_occupied=False,
                is_available=True,
                qr_code=f"https://studycafe.mqnet.io/seat/{tenant_id}/{s_num}",
            )
            db.add(seat)
        db.commit()


@router.get("/", summary="전체 20개 좌석 현황 조회 (A-01 ~ A-20)")
async def get_all_seats(
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db),
):
    """오리지널 구역별 20개 좌석(FOCUS/NORMAL/LAPTOP) 목록을 반환합니다."""
    _ensure_original_20_seats(db, tenant_id)
    seats = db.query(Seat).filter(Seat.tenant_id == tenant_id).order_by(Seat.seat_number).all()

    return {
        "tenant_id": tenant_id,
        "total": len(seats),
        "occupied": sum(1 for s in seats if s.is_occupied or s.status == "OCCUPIED"),
        "available": sum(1 for s in seats if not s.is_occupied and s.status != "OCCUPIED"),
        "seats": [
            {
                "id": s.id,
                "seat_number": s.seat_number,
                "zone_type": s.zone_type,
                "status": s.status,
                "is_occupied": s.is_occupied or (s.status == "OCCUPIED"),
                "is_available": s.is_available,
                "user_name": s.current_user_name,
                "user_type": s.current_user_type or "GENERAL",
                "phone": s.current_user_phone,
            }
            for s in seats
        ],
    }


@router.post("/assign", summary="좌석 배정 및 입실 (오리지널 studycafe API)")
async def assign_seat(
    body: SeatAssignRequest,
    db: Session = Depends(get_db),
):
    """
    이름, 전화번호, 회원유형(일반/관리형)으로 사용자를 등록/확인하고 좌석을 배정합니다.
    """
    _ensure_original_20_seats(db)

    # 1. 좌석 확인
    seat = db.query(Seat).filter(
        (Seat.seat_number == body.seat_number) | (Seat.id == body.seat_number)
    ).first()
    if not seat:
        raise HTTPException(status_code=404, detail="좌석을 찾을 수 없습니다.")
    if seat.is_occupied or seat.status == "OCCUPIED":
        raise HTTPException(status_code=409, detail=f"이미 다른 사용자가 이용 중인 좌석입니다 ({seat.seat_number}).")

    # 2. 사용자 확인 또는 생성
    user = db.query(StudyCafeUser).filter(StudyCafeUser.phone == body.phone).first()
    if not user:
        user = StudyCafeUser(
            id=str(uuid.uuid4()),
            name=body.name,
            phone=body.phone,
            user_type=body.user_type or "GENERAL",
            tenant_id=seat.tenant_id,
        )
        db.add(user)
    else:
        user.name = body.name
        user.user_type = body.user_type or user.user_type

    # 3. 좌석 점유 상태 변경
    seat.is_occupied = True
    seat.status = "OCCUPIED"
    seat.current_user_id = user.id
    seat.current_user_name = user.name
    seat.current_user_phone = user.phone
    seat.current_user_type = user.user_type

    # 4. 세션 기록 생성
    now = datetime.datetime.now(datetime.timezone.utc)
    session = StudyCafeSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_name=user.name,
        user_phone=user.phone,
        user_type=user.user_type,
        seat_id=seat.id,
        seat_number=seat.seat_number,
        tenant_id=seat.tenant_id,
        check_in_at=now,
    )
    db.add(session)
    db.commit()

    type_kr = "관리형 회원" if user.user_type == "MANAGED" else "일반 회원"
    return {
        "success": True,
        "message": f"[입실 완료] {seat.seat_number} ({seat.zone_type}구역) 좌석에 {user.name} 님({type_kr}) 배정이 완료되었습니다 (도어락 자동 개방).",
        "seat_number": seat.seat_number,
        "zone_type": seat.zone_type,
        "user_name": user.name,
        "user_type": user.user_type,
        "session_id": session.id,
        "check_in_at": now.isoformat(),
    }


@router.post("/leave/{seat_number}", summary="좌석 퇴실 (오리지널 studycafe API)")
async def leave_seat(
    seat_number: str,
    db: Session = Depends(get_db),
):
    """해당 좌석 이용을 종료하고 퇴실 처리합니다."""
    seat = db.query(Seat).filter(
        (Seat.seat_number == seat_number) | (Seat.id == seat_number)
    ).first()
    if not seat:
        raise HTTPException(status_code=404, detail="좌석을 찾을 수 없습니다.")

    seat.is_occupied = False
    seat.status = "EMPTY"
    prev_user_name = seat.current_user_name or "회원"
    seat.current_user_id = None
    seat.current_user_name = None
    seat.current_user_phone = None
    seat.current_user_type = "GENERAL"

    now = datetime.datetime.now(datetime.timezone.utc)
    last_session = db.query(StudyCafeSession).filter(
        StudyCafeSession.seat_id == seat.id,
        StudyCafeSession.check_out_at.is_(None),
    ).order_by(StudyCafeSession.check_in_at.desc()).first()

    used_min = 0
    if last_session:
        last_session.check_out_at = now
        if last_session.check_in_at:
            used_min = int((now - last_session.check_in_at.replace(tzinfo=datetime.timezone.utc)).total_seconds() / 60)
            last_session.used_minutes = max(1, used_min)

    db.commit()

    return {
        "success": True,
        "message": f"[퇴실 완료] {seat.seat_number} 좌석 ({prev_user_name} 님) 퇴실 처리가 완료되었습니다.",
        "seat_number": seat.seat_number,
        "used_minutes": used_min,
    }


# 호환용 라우트 (기존 /check-in, /check-out)
@router.post("/{seat_id}/check-in", summary="좌석 입실 (호환용)")
async def check_in_compat(
    seat_id: str,
    db: Session = Depends(get_db),
):
    return await assign_seat(SeatAssignRequest(seat_number=seat_id, phone="010-0000-0000", name="게스트", user_type="GENERAL"), db)


@router.post("/{seat_id}/check-out", summary="좌석 퇴실 (호환용)")
async def check_out_compat(
    seat_id: str,
    db: Session = Depends(get_db),
):
    return await leave_seat(seat_id, db)


@router.get("/ai-congestion", summary="AI 실시간 혼잡도 및 구역별 추천")
async def get_ai_congestion(
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db),
):
    """Gemini AI가 좌석 점유율을 분석하여 혼잡도 및 최적 구역을 추천합니다."""
    _ensure_original_20_seats(db, tenant_id)
    seats = db.query(Seat).filter(Seat.tenant_id == tenant_id).all()
    total = len(seats)
    occupied = sum(1 for s in seats if s.is_occupied or s.status == "OCCUPIED")

    settings = get_settings()
    service = StudyCafeAIService(api_key=settings.GEMINI_API_KEY)
    
    hour = datetime.datetime.now().hour
    result = await service.predict_congestion(occupied, total, hour)
    return {
        "tenant_id": tenant_id,
        "total_seats": total,
        "occupied_seats": occupied,
        "ai_prediction": result,
    }
