"""
apps/studycafe/backend/routers/branch_router.py
스터디카페 다중 지점(Branch / Tenant) 마스터 관리 라우터.
- 지점 목록 조회 및 좌석/점유 현황 동시 집계
- 신규 지점(가맹점/직영점) 등록 및 설정 변경
- IoT 릴레이 호스트 및 SelfStudy 연동 옵션 제어
"""
import uuid
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from shared.core.base_database import get_db
from apps.studycafe.backend.models import StudyCafeBranch, Seat

logger = logging.getLogger("studycafe.branch")
router = APIRouter()


class BranchCreateRequest(BaseModel):
    branch_id: str
    name: str
    total_seats: Optional[int] = 20
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    relay_type: Optional[str] = "HTTP"
    relay_host: Optional[str] = "127.0.0.1"
    relay_port: Optional[int] = 8080
    has_selfstudy_lms: Optional[bool] = True


class BranchUpdateRequest(BaseModel):
    name: Optional[str] = None
    total_seats: Optional[int] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    relay_type: Optional[str] = None
    relay_host: Optional[str] = None
    relay_port: Optional[int] = None
    has_selfstudy_lms: Optional[bool] = None
    is_active: Optional[bool] = None


def ensure_default_branches_seed(db: Session):
    """기본 3대 지점 시드 데이터 보장 (본점, 강남역점, 대치학원가점)"""
    try:
        count = db.query(StudyCafeBranch).count()
        if count == 0:
            defaults = [
                StudyCafeBranch(
                    id=str(uuid.uuid4()),
                    branch_id="studycafe-main",
                    name="MQnet 스터디카페 본점",
                    total_seats=20,
                    contact_phone="02-1234-5678",
                    address="서울특별시 서초구 서초대로 396",
                    relay_type="HTTP",
                    relay_host="127.0.0.1",
                    relay_port=8080,
                    has_selfstudy_lms=True,
                    is_active=True,
                    is_emergency_open=False
                ),
                StudyCafeBranch(
                    id=str(uuid.uuid4()),
                    branch_id="sc-gangnam",
                    name="MQnet 스터디카페 강남역점",
                    total_seats=20,
                    contact_phone="02-555-1234",
                    address="서울특별시 강남구 테헤란로 101",
                    relay_type="HTTP",
                    relay_host="192.168.1.100",
                    relay_port=8080,
                    has_selfstudy_lms=True,
                    is_active=True,
                    is_emergency_open=False
                ),
                StudyCafeBranch(
                    id=str(uuid.uuid4()),
                    branch_id="sc-daechi",
                    name="MQnet 스터디카페 대치학원가점",
                    total_seats=35,
                    contact_phone="02-777-9876",
                    address="서울특별시 강남구 삼성로 212",
                    relay_type="HTTP",
                    relay_host="192.168.1.101",
                    relay_port=8080,
                    has_selfstudy_lms=True,
                    is_active=True,
                    is_emergency_open=False
                ),
            ]
            for b in defaults:
                db.add(b)
            db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Branch seed notice: {e}")


@router.get("/", summary="전체 지점(매장) 목록 및 현황 조회")
async def list_branches(db: Session = Depends(get_db)):
    """등록된 모든 스터디카페 매장 목록과 각 매장별 실시간 좌석 가동 현황을 반환합니다."""
    ensure_default_branches_seed(db)
    branches = db.query(StudyCafeBranch).filter(StudyCafeBranch.is_active == True).all()

    result = []
    for b in branches:
        # 각 지점별 좌석 점유 현황 집계
        seats = db.query(Seat).filter(Seat.tenant_id == b.branch_id).all()
        occupied = sum(1 for s in seats if s.is_occupied or s.status in ("OCCUPIED", "STEP_OUT"))
        total = len(seats) or b.total_seats

        result.append({
            "id": b.id,
            "branch_id": b.branch_id,
            "name": b.name,
            "total_seats": total,
            "occupied_seats": occupied,
            "available_seats": max(0, total - occupied),
            "contact_phone": b.contact_phone,
            "address": b.address,
            "relay_host": b.relay_host,
            "relay_port": b.relay_port,
            "has_selfstudy_lms": b.has_selfstudy_lms,
            "is_emergency_open": b.is_emergency_open,
            "is_active": b.is_active
        })

    return {
        "success": True,
        "count": len(result),
        "branches": result
    }


@router.get("/{branch_id}", summary="단일 지점 상세 조회")
async def get_branch(branch_id: str, db: Session = Depends(get_db)):
    """특정 지점의 상세 설정 및 정보를 조회합니다."""
    ensure_default_branches_seed(db)
    branch = db.query(StudyCafeBranch).filter(StudyCafeBranch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail=f"지점을 찾을 수 없습니다: {branch_id}")

    seats = db.query(Seat).filter(Seat.tenant_id == branch_id).all()
    occupied = sum(1 for s in seats if s.is_occupied or s.status in ("OCCUPIED", "STEP_OUT"))

    return {
        "success": True,
        "branch": {
            "id": branch.id,
            "branch_id": branch.branch_id,
            "name": branch.name,
            "total_seats": len(seats) or branch.total_seats,
            "occupied_seats": occupied,
            "available_seats": max(0, (len(seats) or branch.total_seats) - occupied),
            "contact_phone": branch.contact_phone,
            "address": branch.address,
            "relay_type": branch.relay_type,
            "relay_host": branch.relay_host,
            "relay_port": branch.relay_port,
            "has_selfstudy_lms": branch.has_selfstudy_lms,
            "is_emergency_open": branch.is_emergency_open,
            "is_active": branch.is_active
        }
    }


@router.post("/", summary="신규 매장(지점/가맹점) 등록")
async def create_branch(body: BranchCreateRequest, db: Session = Depends(get_db)):
    """신규 스터디카페 매장을 등록하고 기본 좌석을 생성합니다."""
    existing = db.query(StudyCafeBranch).filter(StudyCafeBranch.branch_id == body.branch_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"이미 존재하는 지점 코드입니다: {body.branch_id}")

    branch = StudyCafeBranch(
        id=str(uuid.uuid4()),
        branch_id=body.branch_id.strip(),
        name=body.name.strip(),
        total_seats=body.total_seats or 20,
        contact_phone=body.contact_phone,
        address=body.address,
        relay_type=body.relay_type or "HTTP",
        relay_host=body.relay_host or "127.0.0.1",
        relay_port=body.relay_port or 8080,
        has_selfstudy_lms=body.has_selfstudy_lms if body.has_selfstudy_lms is not None else True,
        is_active=True,
        is_emergency_open=False
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)

    # 신규 지점용 좌석 동적 생성
    from apps.studycafe.backend.routers.seat_router import _ensure_original_20_seats
    _ensure_original_20_seats(db, branch.branch_id)

    logger.info(f"신규 지점 등록 완료: {branch.name} ({branch.branch_id}, {branch.total_seats}석)")
    return {
        "success": True,
        "message": f"신규 지점 '{branch.name}'({branch.total_seats}석)이 성공적으로 등록되었습니다.",
        "branch": {
            "branch_id": branch.branch_id,
            "name": branch.name,
            "total_seats": branch.total_seats
        }
    }


@router.patch("/{branch_id}", summary="지점 설정 수정")
async def update_branch(branch_id: str, body: BranchUpdateRequest, db: Session = Depends(get_db)):
    """지점명, 릴레이 IP, 좌석 수 등 설정을 갱신합니다."""
    branch = db.query(StudyCafeBranch).filter(StudyCafeBranch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="지점을 찾을 수 없습니다.")

    if body.name is not None:
        branch.name = body.name.strip()
    if body.total_seats is not None and body.total_seats > 0:
        branch.total_seats = body.total_seats
        # 좌석수 변경 시 동적 좌석 갱신
        from apps.studycafe.backend.routers.seat_router import _ensure_original_20_seats
        _ensure_original_20_seats(db, branch_id)
    if body.contact_phone is not None:
        branch.contact_phone = body.contact_phone
    if body.address is not None:
        branch.address = body.address
    if body.relay_host is not None:
        branch.relay_host = body.relay_host
    if body.relay_port is not None:
        branch.relay_port = body.relay_port
    if body.has_selfstudy_lms is not None:
        branch.has_selfstudy_lms = body.has_selfstudy_lms
    if body.is_active is not None:
        branch.is_active = body.is_active

    db.commit()
    return {
        "success": True,
        "message": f"지점 '{branch.name}'의 설정이 갱신되었습니다.",
        "branch_id": branch.branch_id
    }
