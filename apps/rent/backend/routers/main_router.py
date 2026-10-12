"""
apps/rent/backend/routers/main_router.py
원룸 임차료 관리 시스템 REST API 라우터 (prefix="").
게이트웨이에서 app.include_router(main_router, prefix="/api/rent") 로 마운트됩니다.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..db.models import RentRoom, RentBranch, RentExpense, RentUpgradeRequest, RentTenantHistory
from ..schemas import (
    RoomUpdate, RoomResponse, RoomListResponse,
    PaymentProcessRequest,
    ExpenseCreate, ExpenseResponse, ExpenseListResponse,
    BranchCreate, BranchUpdate, BranchBillingUpdate, BranchResponse, BranchListResponse,
    TenantHistoryResponse, TenantHistoryListResponse,
    SystemStatusResponse,
    AdminLoginRequest, UpgradeRequestPayload, UpgradeApprovePayload
)
from ..services.rent_service import service
from ..config import settings

router = APIRouter(prefix="", tags=["원룸 임차료 관리 (29개실)"])


@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(db: Session = Depends(get_db)):
    """시스템 헬스체크 및 원룸 운영 지표 반환"""
    service.ensure_default_seed(db)
    rooms = db.query(RentRoom).all()
    total_rooms = len(rooms)
    vacant_rooms = sum(1 for r in rooms if not r.name or r.move_out)
    active_contracts = total_rooms - vacant_rooms
    branches_count = db.query(RentBranch).count()
    expenses = db.query(RentExpense).all()
    expenses_total = sum(e.amount for e in expenses)

    return SystemStatusResponse(
        app_id=settings.APP_ID,
        app_name=settings.APP_NAME,
        status="HEALTHY",
        deployment_mode=settings.DEPLOYMENT_MODE,
        total_rooms=total_rooms,
        active_contracts=active_contracts,
        vacant_rooms=vacant_rooms,
        branches_count=branches_count,
        expenses_total=expenses_total
    )


# ── 다중 건물(지점) 관리 라우트 ──
@router.get("/branches", response_model=BranchListResponse)
async def list_branches(
    active_only: bool = Query(False, description="활성 건물만 조회 여부"),
    db: Session = Depends(get_db)
):
    """등록된 건물/지점 목록 및 이용료 수납 현황"""
    branches = service.list_branches(db, active_only=active_only)
    return BranchListResponse(success=True, total=len(branches), branches=branches)


@router.post("/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(payload: BranchCreate, db: Session = Depends(get_db)):
    """신규 건물/별관 등록"""
    existing = service.get_branch(db, payload.branch_id)
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 건물/지점 ID입니다.")
    return service.create_branch(db, payload)


@router.get("/branches/{branch_id}", response_model=BranchResponse)
async def get_branch(branch_id: str, db: Session = Depends(get_db)):
    branch = service.get_branch(db, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="해당 건물을 찾을 수 없습니다.")
    return branch


@router.patch("/branches/{branch_id}", response_model=BranchResponse)
async def update_branch(branch_id: str, payload: BranchUpdate, db: Session = Depends(get_db)):
    updated = service.update_branch(db, branch_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="해당 건물을 찾을 수 없습니다.")
    return updated


@router.patch("/branches/{branch_id}/billing", response_model=BranchResponse)
async def update_branch_billing(branch_id: str, payload: BranchBillingUpdate, db: Session = Depends(get_db)):
    updated = service.update_branch_billing(db, branch_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="해당 건물을 찾을 수 없습니다.")
    return updated


# ── 호실 및 임대차 계약 라우트 ──
@router.get("/rooms", response_model=RoomListResponse)
async def get_all_rooms(
    branch_id: str = Query("main", description="조회할 건물 ID"),
    db: Session = Depends(get_db)
):
    """29개실 전체 정보 및 12개월 납부 장부 조회"""
    rooms = service.get_rooms(db, branch_id=branch_id)
    first_room = min(rooms.keys()) if rooms else 101
    return RoomListResponse(
        success=True,
        branch_id=branch_id,
        total_rooms=len(rooms),
        selected_room=first_room,
        rooms=rooms
    )


@router.get("/rooms/{room_number}", response_model=RoomResponse)
async def get_room_detail(
    room_number: int,
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """특정 호실 계약 및 납부 상세 조회"""
    room = service.get_room(db, room_number=room_number, branch_id=branch_id)
    if not room:
        raise HTTPException(status_code=404, detail=f"{room_number}호를 찾을 수 없습니다.")
    return room


@router.put("/rooms/{room_number}", response_model=RoomResponse)
async def update_room_contract(
    room_number: int,
    payload: RoomUpdate,
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """호실 계약 정보 수정 (임차인, 보증금, 월세, 관리비 등)"""
    updated = service.update_room_contract(db, room_number=room_number, data=payload, branch_id=branch_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"{room_number}호를 찾을 수 없습니다.")
    return updated


# ── 당월 / 과거 납부 처리 ──
@router.post("/rooms/{room_number}/payment", response_model=RoomResponse)
async def process_payment(
    room_number: int,
    payload: PaymentProcessRequest,
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """임차료/관리비 납부 완납 처리 (세입자 정보 연동)"""
    updated = service.process_payment(
        db,
        room_number=room_number,
        month=payload.month,
        branch_id=branch_id,
        paid_date=payload.paid_date,
        note=payload.note or "정상 입금",
        tenant_name=payload.tenant_name
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"{room_number}호를 찾을 수 없습니다.")
    return updated


@router.post("/rooms/{room_number}/cancel-payment", response_model=RoomResponse)
async def cancel_payment(
    room_number: int,
    payload: PaymentProcessRequest,
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """납부 취소 (미납으로 환원)"""
    updated = service.cancel_payment(
        db,
        room_number=room_number,
        month=payload.month,
        branch_id=branch_id
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"{room_number}호를 찾을 수 없습니다.")
    return updated


# ── 전출자 1년 보존 이력 조회 라우트 ──
@router.get("/tenant-histories", response_model=TenantHistoryListResponse)
async def list_tenant_histories(
    branch_id: str = Query("main", description="건물 ID"),
    room_number: Optional[int] = Query(None, description="특정 호실 번호 필터"),
    db: Session = Depends(get_db)
):
    """전출 후 1년간 필수 보존되는 전출자 및 이전 임대차 계약 이력 조회"""
    histories = service.list_tenant_histories(db, branch_id=branch_id, room_number=room_number)
    return TenantHistoryListResponse(
        success=True,
        total=len(histories),
        histories=histories
    )


# ── 지출 장부 라우트 ──
@router.get("/expenses", response_model=ExpenseListResponse)
async def list_expenses(
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """건물 운영 지출 장부 목록 및 합계 조회"""
    expenses = service.list_expenses(db, branch_id=branch_id)
    total_amt = sum(e.amount for e in expenses)
    return ExpenseListResponse(
        success=True,
        total=len(expenses),
        total_amount=total_amt,
        expenses=expenses
    )


@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """오늘 지출 추가"""
    return service.create_expense(db, payload, branch_id=branch_id)


# ── 부가가치세(VAT) 기간별 수납 집계 보고서 라우트 ──
@router.get("/vat-report")
async def get_vat_report(
    branch_id: str = Query("main", description="건물 식별 ID"),
    start_month: int = Query(1, ge=1, le=12, description="시작월 (기본: 1월)"),
    end_month: int = Query(6, ge=1, le=12, description="종료월 (기본: 6월)"),
    year: int = Query(2026, description="정산 연도"),
    room_numbers: Optional[str] = Query(None, description="쉼표로 구분된 대상 호실 목록 (예: 201,202)"),
    db: Session = Depends(get_db)
):
    """부가가치세 신고용 기간별(1~6월, 7~12월 등) 호실별 수납 집계 엑셀 데이터"""
    if start_month > end_month:
        raise HTTPException(status_code=400, detail="시작월은 종료월보다 클 수 없습니다.")
    
    parsed_room_numbers = None
    if room_numbers:
        try:
            parsed_room_numbers = [int(r.strip()) for r in room_numbers.split(",") if r.strip().isdigit()]
        except Exception:
            parsed_room_numbers = None

    return service.get_vat_report(
        db,
        branch_id=branch_id,
        start_month=start_month,
        end_month=end_month,
        year=year,
        room_numbers=parsed_room_numbers
    )


# ── 계정 권한별 동적 로그인 & 등업 신청 ──
@router.post("/auth/admin-login")
async def admin_login(payload: AdminLoginRequest):
    """관리자 로그인 및 동적 라우팅 판정"""
    u = payload.username.strip()
    p = payload.password.strip()

    if u == "admin" and p == "1212":
        return {
            "success": True,
            "role": "superadmin",
            "name": "본사 총괄 최고관리자",
            "redirect_url": "/rent/branches.html",
            "branch_id": None
        }
    elif u == "admin01" and p == "1212":
        return {
            "success": True,
            "role": "branch_admin",
            "name": "1호관 원룸 관리실장",
            "redirect_url": "/rent/?branch=main",
            "branch_id": "main"
        }
    elif u in ("user", "student", "tenant") and p in ("1212", "password"):
        return {
            "success": True,
            "role": "tenant",
            "name": "입주자",
            "redirect_url": "/rent/",
            "branch_id": "main"
        }

    raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")


@router.post("/upgrade-request")
async def request_upgrade(payload: UpgradeRequestPayload, db: Session = Depends(get_db)):
    """관리자/실장 등업 신청 접수"""
    req = RentUpgradeRequest(
        user_name=payload.user_name,
        contact=payload.contact,
        target_branch_id=payload.target_branch_id,
        reason=payload.reason or "",
        status="PENDING"
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"success": True, "message": "등업 신청이 접수되었습니다. 본사 승인 대기 중입니다.", "request_id": req.id}


@router.get("/upgrade-requests")
async def list_upgrade_requests(db: Session = Depends(get_db)):
    """등업 신청 목록 조회 (본사 관리자용)"""
    reqs = db.query(RentUpgradeRequest).order_by(RentUpgradeRequest.created_at.desc()).all()
    return {"success": True, "requests": reqs}


@router.post("/upgrade-requests/approve")
async def approve_upgrade_request(payload: UpgradeApprovePayload, db: Session = Depends(get_db)):
    """등업 신청 승인/반려"""
    req = db.query(RentUpgradeRequest).filter(RentUpgradeRequest.id == payload.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="등업 신청 내역을 찾을 수 없습니다.")

    if payload.action == "APPROVE":
        req.status = "APPROVED"
        req.assigned_branch_id = payload.assigned_branch_id or req.target_branch_id
    else:
        req.status = "REJECTED"
    db.commit()
    return {"success": True, "status": req.status}
