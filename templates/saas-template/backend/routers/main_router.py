"""
templates/saas-template/backend/routers/main_router.py
prefix="" 로 정의된 표준 REST API 라우터.
다중 매장(Multi-Branch) 관제, 지점 CRUD 및 본사 솔루션 이용료 수납(Billing) 관리를 지원합니다.
게이트웨이에서 app.include_router(main_router, prefix="/api/{{APP_ID}}") 로 마운트됩니다.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..db.models import AppItem, AppBranch
from ..schemas import (
    ItemCreate, ItemUpdate, ItemResponse, ItemListResponse,
    BranchCreate, BranchUpdate, BranchBillingUpdate, BranchResponse, BranchListResponse,
    AiAnalysisRequest, SystemStatusResponse
)
from ..services.core_service import service
from ..config import settings

router = APIRouter(prefix="", tags=["{{APP_NAME}} Core"])


def get_route_prefix(request: Optional[Request] = None) -> str:
    """게이트웨이 마운트 경로(/api/{{APP_ID}})와 단독 실행(/api) 동적 판정"""
    if request and f"/{{APP_ID}}" in request.url.path:
        return "/api/{{APP_ID}}"
    return "/api"


@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(db: Session = Depends(get_db)):
    """시스템 헬스체크 및 운영 지표 반환"""
    items_count = db.query(AppItem).count()
    branches_count = db.query(AppBranch).count()
    return SystemStatusResponse(
        app_id=settings.APP_ID,
        app_name=settings.APP_NAME,
        status="HEALTHY",
        deployment_mode=settings.DEPLOYMENT_MODE,
        items_count=items_count,
        branches_count=branches_count,
        storage_dir=settings.STORAGE_DIR
    )


# ── 다중 매장(지점) CRUD & 수납 관리 라우트 ──
@router.get("/branches", response_model=BranchListResponse)
async def list_branches(
    active_only: bool = Query(False, description="활성 지점만 조회 여부"),
    db: Session = Depends(get_db)
):
    """등록된 전체 매장(지점) 목록 및 수납 현황 조회"""
    branches = service.list_branches(db, active_only=active_only)
    return BranchListResponse(success=True, total=len(branches), branches=branches)


@router.get("/branches/{branch_id}", response_model=BranchResponse)
async def get_branch(branch_id: str, db: Session = Depends(get_db)):
    """단일 매장(지점) 상세 조회"""
    branch = service.get_branch(db, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="지점을 찾을 수 없습니다.")
    return branch


@router.post("/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(payload: BranchCreate, db: Session = Depends(get_db)):
    """신규 매장(지점) 등록"""
    try:
        return service.create_branch(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/branches/{branch_id}", response_model=BranchResponse)
async def update_branch(branch_id: str, payload: BranchUpdate, db: Session = Depends(get_db)):
    """매장 기본 정보/설정 갱신"""
    branch = service.update_branch(db, branch_id, payload)
    if not branch:
        raise HTTPException(status_code=404, detail="수정할 매장을 찾을 수 없습니다.")
    return branch


@router.patch("/branches/{branch_id}/billing", response_model=BranchResponse)
async def update_branch_billing(branch_id: str, payload: BranchBillingUpdate, db: Session = Depends(get_db)):
    """매장 솔루션 이용료 수납 상태 갱신 (완납/미납 처리)"""
    branch = service.update_branch_billing(db, branch_id, payload)
    if not branch:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
    return branch


@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, db: Session = Depends(get_db)):
    """매장(지점) 삭제 (가맹 해지)"""
    success = service.delete_branch(db, branch_id)
    if not success:
        raise HTTPException(status_code=404, detail="삭제할 매장을 찾을 수 없습니다.")
    return {"success": True, "message": f"매장 '{branch_id}'이(가) 삭제되었습니다."}


# ── 아이템 관리 라우트 (지점별 필터링 지원) ──
@router.get("/items", response_model=ItemListResponse)
async def list_items(
    branch_id: Optional[str] = Query(None, description="지점/매장 필터"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    status: Optional[str] = Query(None, description="상태 필터"),
    search: Optional[str] = Query(None, description="검색어"),
    db: Session = Depends(get_db)
):
    """아이템 목록 조회 (지점별 필터링 및 검색 지원)"""
    items = service.list_items(db, branch_id=branch_id, category=category, status=status, search=search)
    return ItemListResponse(success=True, total=len(items), items=items)


@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str, db: Session = Depends(get_db)):
    """단일 아이템 상세 조회"""
    item = service.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다.")
    return item


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    """신규 아이템 생성"""
    return service.create_item(db, payload)


@router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, payload: ItemUpdate, db: Session = Depends(get_db)):
    """아이템 정보 수정"""
    item = service.update_item(db, item_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="수정할 아이템을 찾을 수 없습니다.")
    return item


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, db: Session = Depends(get_db)):
    """아이템 삭제"""
    success = service.delete_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="삭제할 아이템을 찾을 수 없습니다.")
    return {"success": True, "message": "삭제 완료"}


@router.post("/ai/analyze")
async def analyze_with_ai(payload: AiAnalysisRequest, db: Session = Depends(get_db)):
    """비동기 스레드 풀 AI 분석 API (지점 컨텍스트 지원)"""
    detail = None
    if payload.context_item_id:
        item = service.get_item(db, payload.context_item_id)
        if item and item.detail:
            detail = str(item.detail)
    result = await service.run_ai_task(payload.prompt, detail, branch_id=payload.branch_id)
    return {"success": True, "data": result}


# ── 계정 권한별 로그인 & 등업 승인 워크플로우 ──
@router.post("/auth/login", summary="관리자 ID/PW 로그인 (역할 및 지점별 자동 분기)")
async def login_admin(payload: AdminLoginRequest):
    """
    admin/1212 -> 본사 매장 관리 센터 (/branches.html)
    admin01/1212 -> 제1매장 본점 관제 (/index.html?branch=main)
    admin02/1212 -> 제2매장 강남역점 관제 (/index.html?branch=branch-gangnam)
    """
    u = payload.username.strip()
    p = payload.password.strip()

    if p != "1212":
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 일치하지 않습니다.")

    if u == "admin":
        role = "superadmin"
        branch_id = "main"
        name = "본사 총괄 최고관리자"
        redirect_url = "./branches.html"
    elif u == "admin01":
        role = "branch_admin"
        branch_id = "main"
        name = "본점 점주실장"
        redirect_url = "./index.html?branch=main"
    elif u == "admin02":
        role = "branch_admin"
        branch_id = "branch-gangnam"
        name = "강남역점 점주실장"
        redirect_url = "./index.html?branch=branch-gangnam"
    else:
        role = "user"
        branch_id = "main"
        name = f"회원_{u}"
        redirect_url = "./index.html"

    return {
        "success": True,
        "message": f"환영합니다, {name}님!",
        "user": {
            "username": u,
            "name": name,
            "role": role,
            "assigned_branch_id": branch_id
        },
        "redirect_url": redirect_url
    }


@router.post("/auth/upgrade/request", summary="점주/관리자 등업 신청 제출")
async def request_upgrade(payload: UpgradeRequestPayload):
    req_item = service.create_upgrade_request(payload)
    return {"success": True, "message": "등업 신청이 접수되었습니다. 본사 승인 대기 중입니다.", "request": req_item}


@router.get("/auth/upgrade/requests", summary="등업 신청 목록 조회 (본사용)")
async def list_upgrade_requests():
    return {"success": True, "requests": service.list_upgrade_requests()}


@router.post("/auth/upgrade/requests/{req_id}/approve", summary="등업 신청 승인 (본사용)")
async def approve_upgrade(req_id: str, payload: Optional[UpgradeApprovePayload] = None):
    assigned = payload.assigned_branch_id if payload else None
    approved_req = service.approve_upgrade_request(req_id, assigned)
    if not approved_req:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")
    return {
        "success": True,
        "message": f"'{approved_req['user_name']}'님이 '{approved_req['assigned_branch_id']}' 점주로 승인되었습니다."
    }


@router.post("/auth/upgrade/requests/{req_id}/reject", summary="등업 신청 반려 (본사용)")
async def reject_upgrade(req_id: str):
    rejected = service.reject_upgrade_request(req_id)
    if not rejected:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")
    return {"success": True, "message": "등업 신청이 반려되었습니다."}

