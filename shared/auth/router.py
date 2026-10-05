"""
shared/auth/router.py
공통 인증 및 RBAC 인가 API 라우터.
모든 앱은 이 라우터를 app.include_router()로 등록하기만 하면 됩니다.

API 엔드포인트:
    POST /auth/register  - 통합 회원가입
    POST /auth/login     - 로그인 (앱 접근 권한 및 RBAC 자동 검증)
    POST /auth/oauth     - 소셜 로그인 (Google, Naver 등)
    GET  /auth/me        - 내 정보 및 권한 조회
    GET  /auth/health    - 헬스체크

RBAC 의존성 주입 도구:
    - get_current_user_dependency: 기본 로그인 사용자
    - require_role(app_id, allowed_roles): 특정 앱의 역할 인가 (예: ["owner", "manager"])
    - require_app_access(app_id): 특정 앱 접근 권한 인가
"""
import os
from fastapi import APIRouter, Depends, Request, Header, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List, Callable

from shared.auth.schemas import (
    UserRegisterRequest, UserLoginRequest, OAuthLoginRequest,
    TokenResponse, UserResponse, UserUpdateRequest,
    PasswordResetRequest, PasswordResetConfirmRequest, WithdrawRequest,
)
from shared.auth.service import AuthService
from shared.auth.models import User
from shared.core.base_database import get_db
from shared.utils.security import decode_access_token

auth_router = APIRouter()


def _get_jwt_settings(request: Request):
    settings = getattr(request.state, "app_settings", None)
    if not settings:
        from shared.core.base_config import get_base_settings
        settings = get_base_settings()
    return settings


def _get_auth_service(request: Request) -> AuthService:
    """요청에서 앱 설정을 읽어 AuthService 인스턴스 반환"""
    settings = _get_jwt_settings(request)
    return AuthService(
        jwt_secret=settings.JWT_SECRET,
        jwt_algorithm=settings.JWT_ALGORITHM,
        jwt_expire_minutes=settings.JWT_EXPIRE_MINUTES,
    )


def _resolve_app_id(request: Request) -> str:
    app_id = getattr(request.state, "app_id", None)
    if not app_id:
        app_id = getattr(request.state, "x_app_id", None)
    if not app_id:
        app_id = request.headers.get("x-app-id") or request.query_params.get("app_id")
    return app_id or "platform"


def get_current_user_dependency(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """JWT 토큰에서 현재 로그인 사용자를 추출하는 의존성"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다. (인증 토큰 누락)"
        )

    token = authorization.replace("Bearer ", "").strip()
    settings = _get_jwt_settings(request)

    payload = decode_access_token(token, settings.JWT_SECRET, settings.JWT_ALGORITHM)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="세션이 만료되었거나 유효하지 않은 토큰입니다. 다시 로그인해 주세요."
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자 계정을 찾을 수 없습니다."
        )
    return user


def require_app_access(target_app_id: Optional[str] = None) -> Callable:
    """
    특정 앱에 대한 사용자의 접근 권한(allowed_apps)을 검사하는 FastAPI Dependency Factory
    """
    def _dependency(
        request: Request,
        current_user: User = Depends(get_current_user_dependency),
    ) -> User:
        app_id = target_app_id or _resolve_app_id(request)
        allowed = current_user.allowed_apps if current_user.allowed_apps is not None else ["*"]
        if "*" not in allowed and app_id not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"해당 계정은 [{app_id}] 앱을 이용할 권한이 없습니다. (허용된 앱: {', '.join(allowed)})"
            )
        return current_user
    return _dependency


def require_role(app_id: str, allowed_roles: List[str]) -> Callable:
    """
    특정 앱 내에서 사용자의 역할(RBAC)을 검사하는 FastAPI Dependency Factory
    예:
        @router.post("/orders")
        async def create_order(user: User = Depends(require_role("store", ["owner", "manager", "staff"]))):
            ...
        @router.get("/settlement")
        async def get_settlement(user: User = Depends(require_role("store", ["owner"]))):
            ...
    """
    def _dependency(
        current_user: User = Depends(get_current_user_dependency),
    ) -> User:
        # 1. 슈퍼어드민은 모든 역할 통과
        if current_user.role == "superadmin":
            return current_user

        # 2. 사용자의 앱별 역할 확인
        user_roles = current_user.app_roles or {}
        role = user_roles.get(app_id, current_user.role)

        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"이 작업을 수행할 권한이 없습니다. (현재 권한: '{role}', 필요 권한: {', '.join(allowed_roles)})"
            )
        return current_user
    return _dependency


@auth_router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    request: Request,
    body: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """통합 회원가입 (모든 앱 공통)"""
    service = _get_auth_service(request)
    app_id = _resolve_app_id(request)
    user = await service.register(db, body, app_id)
    return UserResponse(**user.to_dict())


@auth_router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """로그인 (모든 앱 공통 및 앱별 접근/역할 검증)"""
    service = _get_auth_service(request)
    app_id = _resolve_app_id(request)
    return await service.login(db, body, app_id)


@auth_router.post("/oauth", response_model=TokenResponse)
async def oauth_login(
    request: Request,
    body: OAuthLoginRequest,
    db: Session = Depends(get_db),
):
    """소셜 로그인 (Google / Naver 등)"""
    service = _get_auth_service(request)
    app_id = body.app_id or _resolve_app_id(request)
    return await service.oauth_login(db, body, app_id)


@auth_router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user_dependency),
):
    """내 정보 및 권한 조회 (모든 앱 공통)"""
    return UserResponse(**current_user.to_dict())


@auth_router.patch("/me", response_model=UserResponse)
@auth_router.put("/me", response_model=UserResponse)
async def update_me(
    request: Request,
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    """내 개인정보 및 비밀번호 변경"""
    service = _get_auth_service(request)
    updated_user = await service.update_profile(db, current_user, body)
    return UserResponse(**updated_user.to_dict())


@auth_router.get("/me/storage")
async def get_my_storage(
    request: Request,
    current_user: User = Depends(get_current_user_dependency),
):
    """내 개인 스토리지 사용량(전체/앱별) 및 구독 플랜 현황"""
    service = _get_auth_service(request)
    return await service.get_storage_summary(current_user)


@auth_router.delete("/me")
async def withdraw_me(
    request: Request,
    body: WithdrawRequest,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    """회원 탈퇴 (계정 + 개인 격리 스토리지 영구 삭제)"""
    service = _get_auth_service(request)
    return await service.withdraw(db, current_user, body.password, body.confirm_text)


@auth_router.post("/password-reset/request")
async def password_reset_request(
    request: Request,
    body: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """비밀번호 찾기: 6자리 인증 코드 발급"""
    service = _get_auth_service(request)
    return await service.request_password_reset(db, body.email)


@auth_router.post("/password-reset/confirm")
async def password_reset_confirm(
    request: Request,
    body: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    """비밀번호 찾기: 인증 코드 확인 후 새 비밀번호 설정"""
    service = _get_auth_service(request)
    return await service.confirm_password_reset(db, body.email, body.code, body.new_password)


@auth_router.get("/health", include_in_schema=False)
async def auth_health():
    return {"status": "auth service running", "rbac": True, "oauth": ["google", "naver"]}

