"""
apps/studycafe/backend/routers/seat_router.py
스터디카페 좌석 배정 및 퇴실 라우터 (오리지널 studycafe 컨셉 100% 복원).
- 좌석: A-01 ~ A-20
- 구역: FOCUS (포커스존), NORMAL (일반존), LAPTOP (노트북존)
- 회원: GENERAL (일반회원), MANAGED (관리형회원)
"""
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import datetime

from shared.core.base_database import get_db
from sqlalchemy import text
from apps.studycafe.backend.models import Seat, StudyCafeUser, StudyCafeSession, Ticket, PatrolLog, StudyCafeBranch
from apps.studycafe.backend.config import get_settings
from apps.studycafe.backend.db.studycafe_ai_service import StudyCafeAIService

router = APIRouter()


class SeatAssignRequest(BaseModel):
    seat_number: str
    phone: str
    name: str
    user_type: Optional[str] = "GENERAL"  # 'GENERAL' | 'MANAGED'
    user_id: Optional[str] = None
    is_minor: Optional[bool] = None


def _ensure_sqlite_columns(db: Session):
    """SQLite 동적 컬럼 마이그레이션 (고정석 컬럼 등)"""
    try:
        bind = db.get_bind()
        if bind.dialect.name == "sqlite":
            with bind.connect() as conn:
                u_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(studycafe_users)")).fetchall()]
                if "fixed_seat_number" not in u_cols:
                    conn.execute(text("ALTER TABLE studycafe_users ADD COLUMN fixed_seat_number TEXT"))
                s_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(studycafe_seats)")).fetchall()]
                if "is_fixed" not in s_cols:
                    conn.execute(text("ALTER TABLE studycafe_seats ADD COLUMN is_fixed INTEGER DEFAULT 0"))
                if "fixed_user_name" not in s_cols:
                    conn.execute(text("ALTER TABLE studycafe_seats ADD COLUMN fixed_user_name TEXT"))
                if "fixed_user_phone" not in s_cols:
                    conn.execute(text("ALTER TABLE studycafe_seats ADD COLUMN fixed_user_phone TEXT"))
                conn.commit()
    except Exception:
        pass


def _ensure_original_20_seats(db: Session, tenant_id: str = "studycafe-main"):
    """오리지널 studycafe 구역별 좌석 시딩 및 스키마 검증 (지점별 좌석 수 자동 반영)"""
    _ensure_sqlite_columns(db)

    # 지점 시드 확인
    from apps.studycafe.backend.routers.branch_router import ensure_default_branches_seed
    ensure_default_branches_seed(db)

    branch = db.query(StudyCafeBranch).filter(StudyCafeBranch.branch_id == tenant_id).first()
    target_count = (branch.total_seats if branch and branch.total_seats else 20)

    seats = db.query(Seat).filter(Seat.tenant_id == tenant_id).all()
    
    # 만약 좌석이 없거나 규격과 다르면 지점 설정 좌석 수(A-01~A-N)로 갱신
    if len(seats) < target_count or (seats and not seats[0].seat_number.startswith("A-")):
        # 기존 임시 좌석 삭제 후 신규 생성
        db.query(Seat).filter(Seat.tenant_id == tenant_id).delete()
        db.commit()

        focus_threshold = max(4, int(target_count * 0.4))
        normal_threshold = max(focus_threshold + 4, int(target_count * 0.8))

        for i in range(1, target_count + 1):
            s_num = f"A-{i:02d}"
            if 1 <= i <= focus_threshold:
                zone = "FOCUS"
            elif focus_threshold < i <= normal_threshold:
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

    # 사용자 정보 매핑 (청소년 및 심야 예외 여부 조회)
    user_map = {}
    phones = [s.current_user_phone for s in seats if s.current_user_phone]
    if phones:
        users = db.query(StudyCafeUser).filter(StudyCafeUser.phone.in_(phones)).all()
        user_map = {u.phone: u for u in users}

    return {
        "tenant_id": tenant_id,
        "total": len(seats),
        "occupied": sum(1 for s in seats if s.is_occupied or s.status in ("OCCUPIED", "STEP_OUT")),
        "available": sum(1 for s in seats if not s.is_occupied and s.status not in ("OCCUPIED", "STEP_OUT")),
        "step_out_count": sum(1 for s in seats if s.status == "STEP_OUT"),
        "seats": [
            {
                "id": s.id,
                "seat_number": s.seat_number,
                "zone_type": s.zone_type,
                "status": s.status,
                "is_occupied": s.is_occupied or (s.status in ("OCCUPIED", "STEP_OUT")),
                "is_step_out": s.status == "STEP_OUT",
                "step_out_at": s.step_out_at.isoformat() if s.step_out_at else None,
                "is_available": s.is_available and (s.status == "EMPTY"),
                "user_name": s.current_user_name,
                "user_type": s.current_user_type or "GENERAL",
                "phone": s.current_user_phone,
                "is_minor": user_map[s.current_user_phone].is_minor if (s.current_user_phone and s.current_user_phone in user_map) else False,
                "night_exempt": user_map[s.current_user_phone].night_exempt if (s.current_user_phone and s.current_user_phone in user_map) else False,
                "is_fixed": getattr(s, "is_fixed", False),
                "fixed_user_name": getattr(s, "fixed_user_name", None),
                "fixed_user_phone": getattr(s, "fixed_user_phone", None),
            }
            for s in seats
        ],
    }


@router.get("/my-seat", summary="현재 사용자 배정 좌석 조회")
async def get_my_seat(
    user_id: Optional[str] = None,
    phone: Optional[str] = None,
    name: Optional[str] = None,
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db),
):
    """현재 사용자가 이용 중인 좌석 정보 반환 (스터디카페 & 자기주도학습 연동용)"""
    _ensure_original_20_seats(db, tenant_id)
    query = db.query(Seat).filter(
        Seat.tenant_id == tenant_id,
        (Seat.is_occupied == True) | (Seat.status.in_(["OCCUPIED", "STEP_OUT"]))
    )
    seat = None
    if user_id:
        seat = query.filter(Seat.current_user_id == user_id).first()
    if not seat and phone:
        seat = query.filter(Seat.current_user_phone == phone).first()
    if not seat and name:
        seat = query.filter(Seat.current_user_name == name).first()
    
    if seat:
        session = db.query(StudyCafeSession).filter(
            StudyCafeSession.seat_id == seat.id,
            StudyCafeSession.check_out_at.is_(None)
        ).order_by(StudyCafeSession.check_in_at.desc()).first()
        check_in_str = session.check_in_at.isoformat() if session and session.check_in_at else None

        # 외출 경과 시간 및 잔여 시간 (표준 60분 허용)
        remaining_step_out_min = None
        if seat.status == "STEP_OUT" and seat.step_out_at:
            now = datetime.datetime.now(datetime.timezone.utc)
            elapsed_m = int((now - seat.step_out_at.replace(tzinfo=datetime.timezone.utc)).total_seconds() / 60)
            remaining_step_out_min = max(0, 60 - elapsed_m)

        return {
            "has_seat": True,
            "seat": {
                "id": seat.id,
                "seat_number": seat.seat_number,
                "zone_type": seat.zone_type,
                "status": seat.status,
                "is_step_out": seat.status == "STEP_OUT",
                "step_out_at": seat.step_out_at.isoformat() if seat.step_out_at else None,
                "remaining_step_out_minutes": remaining_step_out_min,
                "user_name": seat.current_user_name,
                "user_type": seat.current_user_type or "GENERAL",
                "phone": seat.current_user_phone,
                "check_in_at": check_in_str,
            }
        }
    return {"has_seat": False, "seat": None}


@router.post("/assign", summary="좌석 배정 및 입실 (오리지널 studycafe API)")
async def assign_seat(
    body: SeatAssignRequest,
    db: Session = Depends(get_db),
):
    """
    이름, 전화번호, 회원유형(일반/관리형)으로 사용자를 등록/확인하고 좌석을 배정합니다.
    유효 이용권(시간권/정기권/관리형)을 확인 및 바인딩합니다.
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

    # 🎯 고정석 보호: 타인의 관리형 고정석으로 지정된 좌석이면 일반 배정 차단
    if getattr(seat, "is_fixed", False) and getattr(seat, "fixed_user_phone", None):
        if seat.fixed_user_phone != body.phone:
            raise HTTPException(status_code=403, detail=f"[{seat.seat_number}] 좌석은 관리형 회원 전용 고정석으로 지정되어 일반 배정이 불가합니다.")

    # 2. 사용자 확인 또는 생성
    user = db.query(StudyCafeUser).filter(StudyCafeUser.phone == body.phone).first()
    if not user:
        user = StudyCafeUser(
            id=body.user_id or str(uuid.uuid4()),
            name=body.name,
            phone=body.phone,
            user_type="GENERAL",
            tenant_id=seat.tenant_id,
        )
        db.add(user)
        db.flush()
    else:
        user.name = body.name

    if body.is_minor is not None:
        user.is_minor = body.is_minor

    # 🎯 청소년 22:00 ~ 09:00 심야 셧다운 제한 검사 (청소년보호법 및 학원법 준수, 점주 심야 예외 승인 지원)
    if user.is_minor and not user.night_exempt:
        kst_now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)
        if kst_now.hour >= 22 or kst_now.hour < 9:
            raise HTTPException(
                status_code=403,
                detail="청소년 보호법 및 운영 규정에 따라 청소년(미성년자)은 심야 시간대(22:00 ~ 09:00) 입실이 제한됩니다. (점주 심야 예외 승인 필요)"
            )

    # 3. 유효 이용권(Ticket) 조회 (정기권, 기간권, 잔여시간권 확인)
    now = datetime.datetime.now(datetime.timezone.utc)
    active_ticket = db.query(Ticket).filter(
        (Ticket.user_id == user.id) | (Ticket.user_id == user.phone),
        Ticket.is_active == True,
        (Ticket.remaining_minutes > 0) | (Ticket.remaining_minutes.is_(None))
    ).order_by(Ticket.created_at.desc()).first()

    # 유효 기간 확인
    if active_ticket and active_ticket.valid_until:
        t_until = active_ticket.valid_until.replace(tzinfo=datetime.timezone.utc) if active_ticket.valid_until.tzinfo is None else active_ticket.valid_until
        if t_until < now:
            active_ticket.is_active = False
            active_ticket = None

    if not active_ticket:
        # 🎯 테스트/데모 지원: demo-user나 test-user로 발급된 모의 티켓이 있다면 현재 사용자와 자동 매핑
        fallback_ticket = db.query(Ticket).filter(
            Ticket.user_id.in_(["demo-user", "test-user", "test"]),
            Ticket.is_active == True,
            (Ticket.remaining_minutes > 0) | (Ticket.remaining_minutes.is_(None))
        ).order_by(Ticket.created_at.desc()).first()
        if fallback_ticket:
            fallback_ticket.user_id = user.id
            db.flush()
            active_ticket = fallback_ticket
        else:
            # ⚠️ 유효 이용권(잔여 시간)이 없으므로 결제창 유도 (HTTP 402)
            raise HTTPException(
                status_code=402,
                detail="보유 중인 유효 이용권이 없거나 잔여 시간이 만료되었습니다. 이용권을 먼저 구매해 주세요."
            )

    # 🎯 결제/보유한 이용권(Ticket)에 의해 회원 유형 자동 결정
    # 이용권 이름에 '관리형' 또는 플랜 type이 'managed'이면 MANAGED, 그 외 일반권은 GENERAL
    if "관리형" in (active_ticket.ticket_type or "") or "managed" in (active_ticket.ticket_type or "").lower():
        user.user_type = "MANAGED"
    else:
        user.user_type = "GENERAL"

    # 4. 좌석 점유 상태 변경
    seat.is_occupied = True
    seat.status = "OCCUPIED"
    seat.current_user_id = user.id
    seat.current_user_name = user.name
    seat.current_user_phone = user.phone
    seat.current_user_type = user.user_type
    seat.step_out_at = None

    # 5. 세션 기록 생성 (티켓 ID 바인딩)
    session = StudyCafeSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_name=user.name,
        user_phone=user.phone,
        user_type=user.user_type,
        seat_id=seat.id,
        seat_number=seat.seat_number,
        ticket_id=active_ticket.id if active_ticket else None,
        tenant_id=seat.tenant_id,
        check_in_at=now,
    )
    db.add(session)
    db.commit()

    type_kr = "관리형 회원 (SelfStudy OS)" if user.user_type == "MANAGED" else "일반 자율 회원"
    ticket_desc = f"{active_ticket.ticket_type} (잔여: {active_ticket.remaining_minutes or 0}분)" if active_ticket else "이용권 연동"
    return {
        "success": True,
        "message": f"[입실 완료] {seat.seat_number} ({seat.zone_type}구역) 좌석에 {user.name} 님({type_kr}) 배정이 완료되었습니다 (출입문 5초 개방).",
        "seat_number": seat.seat_number,
        "zone_type": seat.zone_type,
        "user_name": user.name,
        "user_type": user.user_type,
        "ticket_info": ticket_desc,
        "session_id": session.id,
        "check_in_at": now.isoformat(),
    }


class AutoAssignFixedRequest(BaseModel):
    user_id: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    tenant_id: str = "studycafe-main"


@router.post("/auto-assign-fixed", summary="고정석 회원(4주 관리형, 12주 올인원) 자동 입실 및 좌석 배정 건너뛰기")
async def auto_assign_fixed_seat(
    body: AutoAssignFixedRequest,
    db: Session = Depends(get_db),
):
    """
    4주 관리형 프리미엄 패스 및 12주 D-day 올인원 패스 회원은 고정 자리를 배정받으므로,
    로그인 시 좌석 선택/배정 과정을 건너뛰고 자동으로 고정석에 입실 처리 및 출입문을 개방합니다.
    """
    _ensure_original_20_seats(db, body.tenant_id)
    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. 사용자 확인 또는 생성
    user = None
    if body.phone:
        user = db.query(StudyCafeUser).filter(StudyCafeUser.phone == body.phone).first()
    if not user and body.user_id:
        user = db.query(StudyCafeUser).filter(
            (StudyCafeUser.id == body.user_id) | (StudyCafeUser.phone == body.user_id)
        ).first()

    if not user:
        user = StudyCafeUser(
            id=body.user_id or str(uuid.uuid4()),
            name=body.name or "관리형 회원",
            phone=body.phone or "010-5555-4444",
            user_type="MANAGED",
            tenant_id=body.tenant_id,
        )
        db.add(user)
        db.flush()

    # 2. 유효 이용권 확인 (4주 관리형 프리미엄, 12주 올인원 패스 여부)
    active_ticket = db.query(Ticket).filter(
        (Ticket.user_id == user.id) | (Ticket.user_id == user.phone),
        Ticket.is_active == True,
    ).order_by(Ticket.created_at.desc()).first()

    # 데모/테스트 지원
    if not active_ticket:
        fallback = db.query(Ticket).filter(
            Ticket.user_id.in_(["demo-user", "test-user", "test"]),
            Ticket.is_active == True,
        ).order_by(Ticket.created_at.desc()).first()
        if fallback:
            fallback.user_id = user.id
            db.flush()
            active_ticket = fallback

    is_managed_fixed = False
    if active_ticket:
        t_name = str(active_ticket.ticket_type or "")
        if "관리형" in t_name or "12주" in t_name or "올인원" in t_name or getattr(active_ticket, "ticket_type", "") in ["managed_4w", "managed_12w"]:
            is_managed_fixed = True
    elif user.user_type == "MANAGED":
        is_managed_fixed = True

    if not is_managed_fixed:
        return {
            "success": False,
            "is_managed_fixed": False,
            "message": "고정석 자동 배정 대상(4주 관리형 프리미엄, 12주 올인원 패스)이 아닙니다."
        }

    # 3. 회원을 MANAGED로 확정
    user.user_type = "MANAGED"

    # 4. 이미 현재 좌석을 이용(입실 or 외출) 중인지 확인
    existing_seat = db.query(Seat).filter(
        Seat.tenant_id == body.tenant_id,
        (Seat.current_user_id == user.id) | (Seat.current_user_phone == user.phone),
        (Seat.is_occupied == True) | (Seat.status.in_(["OCCUPIED", "STEP_OUT"]))
    ).first()

    if existing_seat:
        return {
            "success": True,
            "is_managed_fixed": True,
            "already_seated": True,
            "seat_number": existing_seat.seat_number,
            "zone_type": existing_seat.zone_type,
            "user_name": user.name,
            "message": f"이미 고정석 [{existing_seat.seat_number}]에 입실되어 있습니다."
        }

    # 5. 사용자 고정석 결정 (기존 지정석이 있거나, 없으면 FOCUS 구역 첫 빈자리 배정)
    target_seat = None
    fixed_num = getattr(user, "fixed_seat_number", None)
    if fixed_num:
        target_seat = db.query(Seat).filter(
            Seat.tenant_id == body.tenant_id,
            Seat.seat_number == fixed_num
        ).first()

    if not target_seat or target_seat.is_occupied:
        # FOCUS zone(A-01 ~ A-08)의 빈 좌석 우선 탐색
        target_seat = db.query(Seat).filter(
            Seat.tenant_id == body.tenant_id,
            Seat.zone_type == "FOCUS",
            Seat.is_occupied == False,
            Seat.status == "EMPTY"
        ).order_by(Seat.seat_number).first()

    if not target_seat:
        # 빈 좌석 아무거나
        target_seat = db.query(Seat).filter(
            Seat.tenant_id == body.tenant_id,
            Seat.is_occupied == False,
            Seat.status == "EMPTY"
        ).order_by(Seat.seat_number).first()

    if not target_seat:
        raise HTTPException(status_code=409, detail="현재 만석으로 고정석을 자동 배정할 수 없습니다. 관리자에게 문의하세요.")

    # 6. 고정석 영구 바인딩 및 입실 점유 처리
    user.fixed_seat_number = target_seat.seat_number
    target_seat.is_fixed = True
    target_seat.fixed_user_phone = user.phone
    target_seat.fixed_user_name = user.name

    target_seat.is_occupied = True
    target_seat.status = "OCCUPIED"
    target_seat.current_user_id = user.id
    target_seat.current_user_name = user.name
    target_seat.current_user_phone = user.phone
    target_seat.current_user_type = "MANAGED"
    target_seat.step_out_at = None

    # 7. 세션 생성
    session = StudyCafeSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_name=user.name,
        user_phone=user.phone,
        user_type="MANAGED",
        seat_id=target_seat.id,
        seat_number=target_seat.seat_number,
        ticket_id=active_ticket.id if active_ticket else None,
        tenant_id=target_seat.tenant_id,
        check_in_at=now,
    )
    db.add(session)
    db.commit()

    ticket_name = active_ticket.ticket_type if active_ticket else "관리형 프리미엄 패스"
    return {
        "success": True,
        "is_managed_fixed": True,
        "already_seated": False,
        "seat_number": target_seat.seat_number,
        "zone_type": target_seat.zone_type,
        "user_name": user.name,
        "user_type": "MANAGED",
        "ticket_type": ticket_name,
        "message": f"🎉 [{ticket_name}] 전용 고정 좌석 [{target_seat.seat_number}]으로 자동 배정 및 입실 완료되었습니다. (출입문 5초 개방 🔓)"
    }


@router.post("/leave/{seat_number}", summary="좌석 퇴실 및 이용권 시간 실차감")
async def leave_seat(
    seat_number: str,
    db: Session = Depends(get_db),
):
    """해당 좌석 이용을 종료하고 실제 사용 시간을 계산하여 이용권에서 차감합니다."""
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
    seat.step_out_at = None

    now = datetime.datetime.now(datetime.timezone.utc)
    last_session = db.query(StudyCafeSession).filter(
        StudyCafeSession.seat_id == seat.id,
        StudyCafeSession.check_out_at.is_(None),
    ).order_by(StudyCafeSession.check_in_at.desc()).first()

    used_min = 0
    remaining_ticket_min = None
    if last_session:
        last_session.check_out_at = now
        if last_session.check_in_at:
            used_min = int((now - last_session.check_in_at.replace(tzinfo=datetime.timezone.utc)).total_seconds() / 60)
            last_session.used_minutes = max(1, used_min)

        # 이용권(Ticket) 시간 차감
        if last_session.ticket_id:
            ticket = db.query(Ticket).filter(Ticket.id == last_session.ticket_id).first()
            if ticket and ticket.remaining_minutes is not None:
                rem_min: int = getattr(ticket, "remaining_minutes", 0) or 0
                used_m: int = getattr(last_session, "used_minutes", 0) or 0
                ticket.remaining_minutes = max(0, rem_min - used_m)
                remaining_ticket_min = ticket.remaining_minutes
                if ticket.remaining_minutes <= 0:
                    ticket.is_active = False

    db.commit()

    return {
        "success": True,
        "message": f"[퇴실 완료] {seat.seat_number} 좌석 ({prev_user_name} 님) 퇴실 처리가 완료되었습니다.",
        "seat_number": seat.seat_number,
        "used_minutes": used_min,
        "remaining_ticket_minutes": remaining_ticket_min,
    }


@router.post("/step-out/{seat_number}", summary="외출하기 (자리비움, 최대 60분 보존)")
async def step_out_seat(
    seat_number: str,
    db: Session = Depends(get_db),
):
    """좌석을 비우고 외출 상태로 전환합니다. (최대 60분 사석 방지 홀딩)"""
    seat = db.query(Seat).filter(
        (Seat.seat_number == seat_number) | (Seat.id == seat_number)
    ).first()
    if not seat or not seat.is_occupied:
        raise HTTPException(status_code=400, detail="현재 이용 중인 좌석이 아닙니다.")

    now = datetime.datetime.now(datetime.timezone.utc)
    seat.status = "STEP_OUT"
    seat.step_out_at = now
    db.commit()

    return {
        "success": True,
        "message": f"[외출 처리 완료] {seat.seat_number} 좌석이 외출(자리비움) 상태로 전환되었습니다. (최대 60분 이내 복귀 필수)",
        "seat_number": seat.seat_number,
        "status": "STEP_OUT",
        "step_out_at": now.isoformat(),
        "allowed_minutes": 60,
    }


@router.post("/step-in/{seat_number}", summary="재입실 (복귀 및 출입문 개방)")
async def step_in_seat(
    seat_number: str,
    db: Session = Depends(get_db),
):
    """외출을 마치고 좌석으로 복귀하며 출입문을 5초간 자동 개방합니다."""
    seat = db.query(Seat).filter(
        (Seat.seat_number == seat_number) | (Seat.id == seat_number)
    ).first()
    if not seat or not seat.is_occupied:
        raise HTTPException(status_code=400, detail="현재 배정된 좌석이 아닙니다.")

    seat.status = "OCCUPIED"
    seat.step_out_at = None
    db.commit()

    return {
        "success": True,
        "message": f"[재입실 완료] {seat.seat_number} 좌석으로 복귀하였습니다. 스마트 출입문이 5초간 개방됩니다.",
        "seat_number": seat.seat_number,
        "status": "OCCUPIED",
        "door_open": True,
    }


@router.post("/cleanup-expired", summary="60분 초과 외출 좌석 및 마감 미퇴실 자동 정리 엔진")
async def cleanup_expired_seats(
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db)
):
    """외출 시작 후 60분이 지난 좌석을 자동으로 퇴실 처리하여 사석을 방지합니다."""
    now = datetime.datetime.now(datetime.timezone.utc)
    seats = db.query(Seat).filter(Seat.tenant_id == tenant_id, Seat.status == "STEP_OUT").all()
    cleaned: list[str] = []

    for seat in seats:
        if seat.step_out_at:
            elapsed_m = int((now - seat.step_out_at.replace(tzinfo=datetime.timezone.utc)).total_seconds() / 60)
            if elapsed_m >= 60:
                seat_num = str(seat.seat_number)
                seat.is_occupied = False
                seat.status = "EMPTY"
                seat.current_user_id = None
                seat.current_user_name = None
                seat.current_user_phone = None
                seat.step_out_at = None

                # 세션 종료
                last_session = db.query(StudyCafeSession).filter(
                    StudyCafeSession.seat_id == seat.id,
                    StudyCafeSession.check_out_at.is_(None)
                ).order_by(StudyCafeSession.check_in_at.desc()).first()
                if last_session:
                    last_session.check_out_at = now
                    used_min = int((now - last_session.check_in_at.replace(tzinfo=datetime.timezone.utc)).total_seconds() / 60)
                    last_session.used_minutes = used_min
                cleaned.append(seat_num)

    # 🎯 청소년 22:00 심야 셧다운 자동 퇴실 (KST 기준)
    kst_now = now + datetime.timedelta(hours=9)
    if kst_now.hour >= 22 or kst_now.hour < 9:
        occupied_seats = db.query(Seat).filter(Seat.tenant_id == tenant_id, Seat.is_occupied == True).all()
        for s in occupied_seats:
            if s.current_user_phone:
                u = db.query(StudyCafeUser).filter(StudyCafeUser.phone == s.current_user_phone).first()
                if u and u.is_minor and not u.night_exempt:
                    s_num = str(s.seat_number)
                    s.is_occupied = False
                    s.status = "EMPTY"
                    s.current_user_id = None
                    s.current_user_name = None
                    s.current_user_phone = None
                    s.step_out_at = None
                    cleaned.append(f"{s_num}(청소년22시퇴실)")

    db.commit()
    return {
        "success": True,
        "cleaned_seats_count": len(cleaned),
        "cleaned_seats": cleaned,
        "checked_at": now.isoformat()
    }


@router.post("/user/{user_id_or_phone}/toggle-night-exempt", summary="22시 청소년 심야 이용 점주 예외 승인 토글")
async def toggle_night_exempt(
    user_id_or_phone: str,
    db: Session = Depends(get_db)
):
    """
    고3 수험생(만 18세 이상) 또는 부모 동의서 제출 학생에 대해 점주가 22시 심야 이용 제한을 해제(예외 승인)합니다.
    """
    user = db.query(StudyCafeUser).filter(
        (StudyCafeUser.id == user_id_or_phone) | (StudyCafeUser.phone == user_id_or_phone)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="해당 회원을 찾을 수 없습니다.")

    user.night_exempt = not user.night_exempt
    db.commit()
    db.refresh(user)

    status_str = "승인 (22시 이후 이용 가능)" if user.night_exempt else "차단 (22시 퇴실 적용)"
    return {
        "success": True,
        "message": f"[{user.name}] 회원의 심야 이용이 '{status_str}' 상태로 변경되었습니다.",
        "user_id": user.id,
        "phone": user.phone,
        "night_exempt": user.night_exempt
    }


@router.post("/cleanup-old-logs", summary="오래된 순찰 기록 자동 파기/정리 (개인정보보호법 준수)")
async def cleanup_old_patrol_logs(
    days: int = 90,
    db: Session = Depends(get_db)
):
    """
    개인정보보호법 준수를 위해 지정된 일수(기본 90일)가 지난 순찰 기록(벌점, 졸음 등)을 안전하게 파기합니다.
    """
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    deleted_count = db.query(PatrolLog).filter(PatrolLog.created_at < cutoff).delete()
    db.commit()
    return {
        "success": True,
        "message": f"{days}일이 경과된 과거 순찰 기록 {deleted_count}건이 안전하게 파기되었습니다.",
        "deleted_count": deleted_count,
        "cutoff_date": cutoff.isoformat()
    }


class PatrolLogRequest(BaseModel):
    seat_number: str
    category: str  # 'SLEEP', 'DISTRACTION', 'AWAY', 'FOCUS'
    penalty: Optional[int] = 0
    note: Optional[str] = None
    manager_name: Optional[str] = "관리실장"


@router.post("/patrol-log", summary="현장 실장 순찰 일지 등록 및 벌점 부여")
async def create_patrol_log(
    body: PatrolLogRequest,
    db: Session = Depends(get_db),
):
    seat = db.query(Seat).filter(Seat.seat_number == body.seat_number).first()
    if not seat:
        raise HTTPException(status_code=404, detail="좌석을 찾을 수 없습니다.")

    user = None
    if seat.current_user_phone:
        user = db.query(StudyCafeUser).filter(StudyCafeUser.phone == seat.current_user_phone).first()

    now = datetime.datetime.now(datetime.timezone.utc)
    log = PatrolLog(
        id=str(uuid.uuid4()),
        tenant_id=seat.tenant_id,
        seat_number=seat.seat_number,
        user_id=user.id if user else seat.current_user_id,
        user_name=user.name if user else seat.current_user_name,
        user_phone=user.phone if user else seat.current_user_phone,
        category=body.category,
        penalty=body.penalty or 0,
        note=body.note,
        manager_name=body.manager_name or "관리실장",
    )
    db.add(log)

    if user and body.penalty:
        curr_pts: int = getattr(user, "penalty_points", 0) or 0
        user.penalty_points = curr_pts + body.penalty

    db.commit()
    db.refresh(log)

    category_kr = {
        "SLEEP": "😴 졸음 주의",
        "DISTRACTION": "📱 휴대폰/딴짓 경고",
        "AWAY": "🚶 무단 장기 이탈",
        "FOCUS": "👍 100% 몰입 우수"
    }.get(body.category, body.category)

    return {
        "success": True,
        "message": f"[{seat.seat_number}석] {category_kr} 기록 등록 완료 (벌점: {body.penalty}점)",
        "log": {
            "id": log.id,
            "seat_number": log.seat_number,
            "user_name": log.user_name,
            "category": log.category,
            "penalty": log.penalty,
            "note": log.note,
            "created_at": now.isoformat(),
        }
    }


@router.get("/admin/dashboard", summary="점주 모바일 실시간 관제 대시보드 API")
async def get_admin_dashboard(
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db)
):
    """점주를 위한 20개 좌석 실시간 모니터링, 점유율, 일일 세션 집계 데이터를 제공합니다."""
    _ensure_original_20_seats(db, tenant_id)
    seats = db.query(Seat).filter(Seat.tenant_id == tenant_id).order_by(Seat.seat_number).all()
    today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    sessions_today = db.query(StudyCafeSession).filter(
        StudyCafeSession.tenant_id == tenant_id,
        StudyCafeSession.check_in_at >= today_start
    ).all()

    total_seats = len(seats)
    occupied_count = sum(1 for s in seats if s.is_occupied or s.status in ("OCCUPIED", "STEP_OUT"))
    step_out_count = sum(1 for s in seats if s.status == "STEP_OUT")

    # 💰 점주 매출 통계 집계 (Ticket 기반 실시간 집계)
    all_tickets = db.query(Ticket).filter(
        (Ticket.tenant_id == tenant_id) | (Ticket.tenant_id == None)
    ).order_by(Ticket.created_at.desc()).all()

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    sales_today = 0
    sales_month = 0
    sales_total = 0
    tickets_today_count = 0
    managed_sales_total = 0
    general_sales_total = 0
    recent_payments = []

    for t in all_tickets:
        p = getattr(t, "price", 0) or 0
        created = t.created_at
        sales_total += p

        is_managed = "관리형" in (t.ticket_type or "") or "managed" in (t.ticket_type or "").lower()
        if is_managed:
            managed_sales_total += p
        else:
            general_sales_total += p

        if created:
            c_utc = created.replace(tzinfo=datetime.timezone.utc) if created.tzinfo is None else created
            if c_utc >= today_start:
                sales_today += p
                tickets_today_count += 1
            if c_utc >= month_start:
                sales_month += p

        if len(recent_payments) < 15:
            recent_payments.append({
                "id": t.id,
                "ticket_type": t.ticket_type,
                "price": p,
                "user_id": t.user_id,
                "created_at": created.isoformat() if created else None,
                "is_active": t.is_active,
                "is_managed": is_managed,
            })

    sales_stats = {
        "sales_today": sales_today,
        "sales_month": sales_month,
        "sales_total": sales_total,
        "tickets_today_count": tickets_today_count,
        "tickets_total_count": len(all_tickets),
        "managed_sales_total": managed_sales_total,
        "general_sales_total": general_sales_total,
        "recent_payments": recent_payments,
    }

    return {
        "tenant_id": tenant_id,
        "total_seats": total_seats,
        "occupied_count": occupied_count,
        "available_count": total_seats - occupied_count,
        "step_out_count": step_out_count,
        "occupancy_rate": round((occupied_count / total_seats * 100), 1) if total_seats > 0 else 0,
        "sessions_today_count": len(sessions_today),
        "sales_stats": sales_stats,
        "seats": [
            {
                "id": s.id,
                "seat_number": s.seat_number,
                "zone_type": s.zone_type,
                "status": s.status,
                "is_occupied": s.is_occupied,
                "user_name": s.current_user_name,
                "user_type": s.current_user_type,
                "phone": s.current_user_phone,
                "step_out_at": s.step_out_at.isoformat() if s.step_out_at else None
            }
            for s in seats
        ]
    }


@router.get("/admin/sales", summary="스터디카페 점주 매출 통계 상세 API")
async def get_admin_sales_details(
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db)
):
    """
    점주를 위한 일일 매출, 월간 누적 매출, 이용권별 결제 내역 및 최근 승인 로그를 제공합니다.
    """
    all_tickets = db.query(Ticket).filter(
        (Ticket.tenant_id == tenant_id) | (Ticket.tenant_id == None)
    ).order_by(Ticket.created_at.desc()).all()

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    sales_today = 0
    sales_month = 0
    sales_total = 0
    tickets_today_count = 0
    managed_sales = 0
    general_sales = 0
    recent_payments = []

    for t in all_tickets:
        p = getattr(t, "price", 0) or 0
        created = t.created_at
        sales_total += p

        is_managed = "관리형" in (t.ticket_type or "") or "managed" in (t.ticket_type or "").lower()
        if is_managed:
            managed_sales += p
        else:
            general_sales += p

        if created:
            c_utc = created.replace(tzinfo=datetime.timezone.utc) if created.tzinfo is None else created
            if c_utc >= today_start:
                sales_today += p
                tickets_today_count += 1
            if c_utc >= month_start:
                sales_month += p

        recent_payments.append({
            "id": t.id,
            "ticket_type": t.ticket_type,
            "price": p,
            "user_id": t.user_id,
            "created_at": created.isoformat() if created else None,
            "is_active": t.is_active,
            "is_managed": is_managed,
        })

    return {
        "success": True,
        "tenant_id": tenant_id,
        "sales_today": sales_today,
        "sales_month": sales_month,
        "sales_total": sales_total,
        "tickets_today_count": tickets_today_count,
        "tickets_total_count": len(all_tickets),
        "managed_sales_total": managed_sales,
        "general_sales_total": general_sales,
        "payments": recent_payments[:50]
    }


def _to_utc_dt(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt


@router.get("/admin/sales/monthly", summary="소득신고 및 세무 정산용 월별 매출 집계")
async def get_monthly_sales_stats(
    year: Optional[int] = None,
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db)
):
    """
    국세청 부가가치세 및 종합소득세 신고를 위한 월별 매출(총액, 공급가액, 부가세 10%) 통계를 제공합니다.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    target_year = year or now.year

    all_tickets = db.query(Ticket).filter(
        (Ticket.tenant_id == tenant_id) | (Ticket.tenant_id == None)
    ).order_by(Ticket.created_at.desc()).all()

    monthly_data = {f"{target_year}-{m:02d}": {
        "year_month": f"{target_year}-{m:02d}",
        "month": m,
        "count": 0,
        "total_amount": 0,
        "supply_value": 0,
        "vat": 0,
        "managed_amount": 0,
        "general_amount": 0,
    } for m in range(1, 13)}

    for t in all_tickets:
        if not t.created_at:
            continue
        c_utc = _to_utc_dt(t.created_at)
        if c_utc and c_utc.year == target_year:
            ym = f"{c_utc.year}-{c_utc.month:02d}"
            if ym in monthly_data:
                p = getattr(t, "price", 0) or 0
                is_managed = "관리형" in (t.ticket_type or "") or "managed" in (t.ticket_type or "").lower()
                monthly_data[ym]["count"] += 1
                monthly_data[ym]["total_amount"] += p
                if is_managed:
                    monthly_data[ym]["managed_amount"] += p
                else:
                    monthly_data[ym]["general_amount"] += p

    months_list = []
    yearly_total = 0
    yearly_count = 0
    yearly_managed = 0
    yearly_general = 0

    for ym in sorted(monthly_data.keys()):
        item = monthly_data[ym]
        tot = item["total_amount"]
        sup = round(tot / 1.1)
        v = tot - sup
        item["supply_value"] = sup
        item["vat"] = v
        months_list.append(item)

        yearly_total += tot
        yearly_count += item["count"]
        yearly_managed += item["managed_amount"]
        yearly_general += item["general_amount"]

    yearly_supply = round(yearly_total / 1.1)
    yearly_vat = yearly_total - yearly_supply

    return {
        "success": True,
        "year": target_year,
        "yearly_summary": {
            "total_amount": yearly_total,
            "supply_value": yearly_supply,
            "vat": yearly_vat,
            "count": yearly_count,
            "managed_amount": yearly_managed,
            "general_amount": yearly_general,
        },
        "months": months_list
    }


@router.get("/admin/sales/range", summary="소득신고 및 세무용 기간 지정 매출 정산")
async def get_sales_by_range(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db)
):
    """
    지정한 기간(시작일~종료일) 동안의 총 매출, 공급가액, 부가세, 일별 추이 및 개별 결제 트랜잭션을 반환합니다.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    if not end_date:
        end_date = now.strftime("%Y-%m-%d")
    if not start_date:
        start_date = now.strftime("%Y-%m-01")

    try:
        s_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
        e_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=datetime.timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다 (YYYY-MM-DD 필요).")

    all_tickets = db.query(Ticket).filter(
        (Ticket.tenant_id == tenant_id) | (Ticket.tenant_id == None)
    ).order_by(Ticket.created_at.desc()).all()

    filtered = []
    daily_map = {}

    for t in all_tickets:
        if not t.created_at:
            continue
        c_utc = _to_utc_dt(t.created_at)
        if c_utc and s_dt <= c_utc <= e_dt:
            p = getattr(t, "price", 0) or 0
            is_managed = "관리형" in (t.ticket_type or "") or "managed" in (t.ticket_type or "").lower()
            sup = round(p / 1.1)
            vat = p - sup
            day_str = c_utc.strftime("%Y-%m-%d")

            filtered.append({
                "id": t.id,
                "created_at": c_utc.isoformat(),
                "created_date": day_str,
                "ticket_type": t.ticket_type,
                "amount": p,
                "supply_value": sup,
                "vat": vat,
                "user_id": t.user_id,
                "is_managed": is_managed,
                "is_active": t.is_active,
            })

            if day_str not in daily_map:
                daily_map[day_str] = {"date": day_str, "count": 0, "total_amount": 0, "supply_value": 0, "vat": 0}
            daily_map[day_str]["count"] += 1
            daily_map[day_str]["total_amount"] += p
            daily_map[day_str]["supply_value"] += sup
            daily_map[day_str]["vat"] += vat

    total_amount = sum(x["amount"] for x in filtered)
    supply_value = round(total_amount / 1.1)
    vat = total_amount - supply_value
    managed_amount = sum(x["amount"] for x in filtered if x["is_managed"])
    general_amount = total_amount - managed_amount

    daily_list = [daily_map[k] for k in sorted(daily_map.keys(), reverse=True)]

    return {
        "success": True,
        "start_date": start_date,
        "end_date": end_date,
        "summary": {
            "total_amount": total_amount,
            "supply_value": supply_value,
            "vat": vat,
            "count": len(filtered),
            "managed_amount": managed_amount,
            "general_amount": general_amount,
        },
        "daily_breakdown": daily_list,
        "payments": filtered
    }


@router.get("/admin/sales/export-csv", summary="세무 신고용 매출 데이터 CSV 다운로드")
async def export_sales_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db)
):
    """
    국세청 세무신고 및 회계사용 Excel 호환 CSV 파일(BOM 포함)을 다운로드합니다.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    if not end_date:
        end_date = now.strftime("%Y-%m-%d")
    if not start_date:
        start_date = now.strftime("%Y-%m-01")

    try:
        s_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
        e_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=datetime.timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다 (YYYY-MM-DD 필요).")

    all_tickets = db.query(Ticket).filter(
        (Ticket.tenant_id == tenant_id) | (Ticket.tenant_id == None)
    ).order_by(Ticket.created_at.desc()).all()

    csv_lines = ["\ufeff거래일시,영수증(ID),이용권상품명,회원식별,결제금액(원),공급가액(원),부가가치세(원),과세구분,상품유형"]
    for t in all_tickets:
        if not t.created_at:
            continue
        c_utc = _to_utc_dt(t.created_at)
        if c_utc and s_dt <= c_utc <= e_dt:
            p = getattr(t, "price", 0) or 0
            sup = round(p / 1.1)
            vat = p - sup
            is_m = "관리형" in (t.ticket_type or "") or "managed" in (t.ticket_type or "").lower()
            type_str = "관리형 고정석 패스" if is_m else "일반 자유석 이용권"
            dt_str = c_utc.strftime("%Y-%m-%d %H:%M:%S")
            csv_lines.append(f'"{dt_str}","{t.id}","{t.ticket_type}","{t.user_id}","{p}","{sup}","{vat}","과세(10%)","{type_str}"')

    csv_content = "\r\n".join(csv_lines)
    filename = f"studycafe_tax_sales_{start_date}_{end_date}.csv"
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )



@router.get("/parent/status", summary="학부모 안심 웹 포털 (Zero-Message) API")
async def get_parent_student_status(
    phone: str,
    tenant_id: str = "studycafe-main",
    db: Session = Depends(get_db)
):
    """
    학부모가 자녀의 전화번호 또는 고유 링크를 통해
    실시간 재실 여부, 오늘 순공 시간, 최근 출결, 현장 순찰 일지를 무료로 확인합니다.
    """
    user = db.query(StudyCafeUser).filter(StudyCafeUser.phone == phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="등록된 학생 정보를 찾을 수 없습니다.")

    # 현재 좌석 배정 여부
    seat = db.query(Seat).filter(Seat.current_user_phone == phone).first()
    today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    sessions = db.query(StudyCafeSession).filter(
        StudyCafeSession.user_phone == phone,
        StudyCafeSession.check_in_at >= today_start
    ).all()

    # 현장 순찰 일지 (졸음/딴짓/벌점 등)
    patrol_logs = db.query(PatrolLog).filter(
        PatrolLog.user_phone == phone,
        PatrolLog.created_at >= today_start
    ).order_by(PatrolLog.created_at.desc()).all()

    today_total_minutes = sum(int(getattr(s, "used_minutes", 0) or 0) for s in sessions)
    current_status = "퇴실"
    if seat:
        current_status = "외출 중 (식사/휴식)" if seat.status == "STEP_OUT" else "집중 학습 중 🟢"

    return {
        "student_name": user.name,
        "student_type": user.user_type,
        "current_status": current_status,
        "current_seat": f"{seat.seat_number} ({seat.zone_type}존)" if seat else "미배정",
        "today_study_minutes": today_total_minutes,
        "today_study_hours": round(float(today_total_minutes) / 60.0, 1),
        "penalty_points": int(getattr(user, "penalty_points", 0) or 0),
        "patrol_reports": [
            {
                "time": p.created_at.strftime("%H:%M") if p.created_at else "",
                "category": p.category,
                "penalty": p.penalty,
                "note": p.note,
                "manager": p.manager_name
            }
            for p in patrol_logs
        ],
        "recent_sessions": [
            {
                "seat_number": s.seat_number,
                "check_in": s.check_in_at.isoformat() if s.check_in_at else None,
                "check_out": s.check_out_at.isoformat() if s.check_out_at else None,
                "used_minutes": s.used_minutes
            }
            for s in sessions
        ]
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
