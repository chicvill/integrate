"""
apps/rent/backend/routers/main_router.py
원룸 임차료 관리 시스템 REST API 라우터 (prefix="").
게이트웨이에서 app.include_router(main_router, prefix="/api/rent") 로 마운트됩니다.
"""
import urllib.parse
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, Body, Response
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
    AdminLoginRequest, UpgradeRequestPayload, UpgradeApprovePayload,
    VatSettingsUpdate, VatSettingsResponse,
    RegisterRequest, UserApprovePayload, UserUpdatePayload
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
    expenses_total: int = 0
    for e in expenses:
        amt = getattr(e, "amount", 0)
        if isinstance(amt, (int, float)):
            expenses_total += int(amt)

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


@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, db: Session = Depends(get_db)):
    """등록된 부동산(지점) 및 관련 데이터 영구 삭제 (메인 부동산은 삭제 불가)"""
    res = service.delete_branch(db, branch_id=branch_id)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res


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


@router.post("/rooms/batch-import")
async def batch_import_rooms(
    payload: List[Dict[str, Any]] = Body(...),
    branch_id: str = Query("main", description="등록 대상 건물 ID"),
    db: Session = Depends(get_db)
):
    """엑셀 파일 등에서 추출한 호실 계약 정보 일괄 등록/갱신"""
    return service.batch_import_rooms(db, branch_id=branch_id, rooms_data=payload)


@router.post("/rooms/ocr-import")
async def ocr_import_rooms(
    payload: Dict[str, Any] = Body(...),
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """엑셀 화면 캡처 이미지(OCR/Vision)로부터 표 데이터 추출"""
    image_b64 = payload.get("image_base64", "")
    if not image_b64:
        raise HTTPException(status_code=400, detail="이미지 데이터가 전달되지 않았습니다.")
    return service.ocr_import_image(image_b64)


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
        tenant_name=payload.tenant_name,
        year=payload.year,
        rent_amount=payload.rent_amount,
        maintenance_amount=payload.maintenance_amount
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
        branch_id=branch_id,
        year=payload.year
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"{room_number}호를 찾을 수 없습니다.")
    return updated


@router.post("/rooms/fill-payments")
async def fill_tenant_payments(
    payload: Dict[str, Any] = Body(default={}),
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """현재 세입자의 전입일부터 현재까지의 과거 납부 내역을 현재 세입자 정보로 일괄 채우기"""
    room_number = payload.get("room_number")
    if room_number is not None:
        try:
            room_number = int(room_number)
        except Exception:
            room_number = None
    return service.fill_tenant_payments(db, branch_id=branch_id, room_number=room_number)


@router.post("/payments/matrix-import")
@router.post("/branches/{branch_id}/payments/matrix-import")
async def batch_import_payment_matrix(
    payload: Dict[str, Any] = Body(...),
    branch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """월별 수납장부 매트릭스(연도-월별 실입금일/금액) 일괄 등록 및 동기화"""
    target_branch = branch_id or payload.get("branch_id") or "main"
    matrix_rooms = payload.get("rooms") or payload.get("matrix_rooms") or []
    if not isinstance(matrix_rooms, list):
        raise HTTPException(status_code=400, detail="rooms 배열 데이터가 필요합니다.")
    return service.batch_import_monthly_matrix(db, branch_id=target_branch, matrix_rooms=matrix_rooms)


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


@router.delete("/tenant-histories/expired")
async def purge_expired_tenant_histories(
    branch_id: str = Query("main", description="건물 ID"),
    db: Session = Depends(get_db)
):
    """전출 후 1년(법적 보존기한)이 지난 만료 세입자 이력 영구 파기/삭제"""
    return service.purge_expired_tenant_histories(db, branch_id=branch_id)


@router.delete("/tenant-histories/{history_id}")
async def delete_tenant_history(
    history_id: str,
    branch_id: str = Query("main", description="건물 ID"),
    db: Session = Depends(get_db)
):
    """특정 전출자 이력 수동 삭제 (테스트 데이터 정리 및 퇴실 취소 호실 복원 시 정리)"""
    res = service.delete_tenant_history(db, history_id=history_id, branch_id=branch_id)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res


# ── 만기 1·2개월 전 도래 호실 목록 조회 라우트 ──
@router.get("/expiring-rooms")
async def get_expiring_rooms(
    branch_id: str = Query("main", description="건물 ID"),
    days_window: int = Query(65, description="조회 기간 일수 (기본 65일, 약 2개월)"),
    db: Session = Depends(get_db)
):
    """만기 1, 2개월 전 도래 호실 리스트 조회 (사전 전출 의사 확인용)"""
    expiring = service.get_expiring_rooms(db, branch_id=branch_id, days_window=days_window)
    return {
        "success": True,
        "branch_id": branch_id,
        "total": len(expiring),
        "rooms": expiring
    }



# ── 지출 장부 라우트 ──
@router.get("/expenses", response_model=ExpenseListResponse)
async def list_expenses(
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """건물 운영 지출 장부 목록 및 합계 조회"""
    expenses = service.list_expenses(db, branch_id=branch_id)
    total_amt: int = 0
    for e in expenses:
        amt = getattr(e, "amount", 0)
        if isinstance(amt, (int, float)):
            total_amt += int(amt)
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
    """지출 항목 추가"""
    return service.create_expense(db, payload, branch_id=branch_id)


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    branch_id: str = Query("main"),
    db: Session = Depends(get_db)
):
    """지출 항목 삭제"""
    deleted = service.delete_expense(db, expense_id=expense_id, branch_id=branch_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="해당 지출 내역을 찾을 수 없습니다.")
    return {"success": True, "message": "지출 내역이 삭제되었습니다."}



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


@router.get("/vat-report/download")
async def download_vat_report(
    branch_id: str = Query("main", description="건물 식별 ID"),
    start_month: int = Query(1, ge=1, le=12, description="시작월"),
    end_month: int = Query(6, ge=1, le=12, description="종료월"),
    year: int = Query(2026, description="정산 연도"),
    format_type: str = Query("excel", regex="^(excel|csv)$", description="다운로드 포맷: excel 또는 csv"),
    room_numbers: Optional[str] = Query(None, description="쉼표 구분 대상 호실 목록"),
    db: Session = Depends(get_db)
):
    """부가가치세 신고용 파일 브라우저 직접 다운로드 (RFC 5987 표준 헤더로 Chrome UUID 버그 완벽 방지)"""
    if start_month > end_month:
        raise HTTPException(status_code=400, detail="시작월은 종료월보다 클 수 없습니다.")

    parsed_room_numbers = None
    if room_numbers:
        try:
            parsed_room_numbers = [int(r.strip()) for r in room_numbers.split(",") if r.strip().isdigit()]
        except Exception:
            parsed_room_numbers = None

    content, media_type, filename = service.generate_vat_download(
        db=db,
        branch_id=branch_id,
        start_month=start_month,
        end_month=end_month,
        year=year,
        format_type=format_type,
        room_numbers=parsed_room_numbers
    )

    encoded_filename = urllib.parse.quote(filename)
    headers = {
        "Content-Disposition": f"attachment; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}",
        "Access-Control-Expose-Headers": "Content-Disposition"
    }

    return Response(content=content, media_type=media_type, headers=headers)


@router.get("/backup/download")
async def download_backup(
    branch_id: str = Query("main", description="건물 식별 ID"),
    db: Session = Depends(get_db)
):
    """전체 시스템 백업 파일 브라우저 직접 다운로드 (RFC 5987 표준 헤더로 Chrome UUID 버그 완벽 방지)"""
    content, media_type, filename = service.generate_backup_download(
        db=db,
        branch_id=branch_id
    )

    encoded_filename = urllib.parse.quote(filename)
    headers = {
        "Content-Disposition": f"attachment; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}",
        "Access-Control-Expose-Headers": "Content-Disposition"
    }

    return Response(content=content, media_type=media_type, headers=headers)


@router.post("/backup/restore")
async def restore_backup(
    payload: Dict[str, Any],
    target_branch_id: str = Query("main", description="복원 대상 건물 식별 ID"),
    db: Session = Depends(get_db)
):
    """전체 시스템 백업 파일 원자적 복원 (다른 건물로도 자유롭게 복구 가능)"""
    return service.restore_full_backup(
        db=db,
        backup_data=payload,
        target_branch_id=target_branch_id
    )


@router.get("/vat-settings", response_model=VatSettingsResponse)
async def get_vat_settings(
    branch_id: str = Query("main", description="건물 식별 ID"),
    db: Session = Depends(get_db)
):
    """지점별 부가세 신고 대상 호실 설정 DB 조회"""
    return service.get_vat_settings(db, branch_id=branch_id)


@router.post("/vat-settings", response_model=VatSettingsResponse)
async def save_vat_settings(
    payload: VatSettingsUpdate,
    db: Session = Depends(get_db)
):
    """지점별 부가세 신고 대상 호실 설정 DB 영구 저장 및 유지"""
    return service.save_vat_settings(
        db,
        branch_id=payload.branch_id,
        target_rooms=payload.vat_target_rooms
    )


# ── 계정 권한별 동적 로그인 & 등업 신청 ──
@router.post("/auth/register")
async def register_account(payload: RegisterRequest, db: Session = Depends(get_db)):
    """지점 관리자 및 회원 신규 가입 신청"""
    try:
        return service.register_user(db, payload)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/auth/login")
@router.post("/auth/admin-login")
async def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    """관리자 로그인 및 동적 라우팅 판정 (DB 기반 검증 및 승인 여부 판정)"""
    try:
        return service.authenticate_user(db, username=payload.username, password=payload.password)
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=401, detail=str(ve))


@router.get("/auth/users")
async def get_all_users(db: Session = Depends(get_db)):
    """등록된 관리자/회원 목록 조회 (본사 관리자 전용)"""
    users = service.list_users(db)
    return {"success": True, "total": len(users), "users": users}


@router.patch("/auth/users/{user_id}/status")
async def approve_or_reject_user(
    user_id: str,
    payload: UserApprovePayload,
    db: Session = Depends(get_db)
):
    """신규 관리자 승인/반려 및 담당 건물 지정"""
    try:
        return service.approve_user(db, user_id=user_id, payload=payload)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.patch("/auth/users/{user_id}")
async def update_user_info(
    user_id: str,
    payload: UserUpdatePayload,
    db: Session = Depends(get_db)
):
    """관리자 정보/비밀번호/배정건물 수정"""
    try:
        return service.update_user(db, user_id=user_id, payload=payload)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.delete("/auth/users/{user_id}")
async def delete_user_account(user_id: str, db: Session = Depends(get_db)):
    """관리자 계정 영구 삭제 (최고관리자 admin 제외)"""
    try:
        return service.delete_user(db, user_id=user_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


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


@router.get("/auth/upgrade/requests")
async def get_upgrade_requests(db: Session = Depends(get_db)):
    """점주/실장 가입 및 등업 신청 목록 (RentUser 기반 통합)"""
    users = service.list_users(db)
    requests = []
    for u in users:
        # admin을 제외한 점주/실장 가입 신청자 노출
        if u["username"] == "admin":
            continue
        requests.append({
            "id": u["id"],
            "username": u["username"],
            "name": u["name"],
            "user_name": f"{u['name']} ({u['username']})",
            "contact": u["phone"],
            "target_branch_id": u["assigned_branch_id"] or "미지정",
            "reason": u["reason"] or "",
            "created_at": u["created_at"],
            "status": u["status"],
            "assigned_branch_id": u["assigned_branch_name"]
        })
    return {"success": True, "requests": requests}


@router.post("/auth/upgrade/requests/{req_id}/approve")
async def approve_upgrade_req(req_id: str, payload: Dict[str, Any] = Body(default={}), db: Session = Depends(get_db)):
    assigned_b = payload.get("assigned_branch_id")
    return service.approve_user(db, user_id=req_id, payload=UserApprovePayload(action="APPROVE", assigned_branch_id=assigned_b))


@router.post("/auth/upgrade/requests/{req_id}/reject")
async def reject_upgrade_req(req_id: str, db: Session = Depends(get_db)):
    return service.approve_user(db, user_id=req_id, payload=UserApprovePayload(action="REJECT"))
