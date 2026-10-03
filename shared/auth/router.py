"""
shared/auth/router.py
공통 인증 API 라우터.
모든 앱은 이 라우터를 app.include_router()로 등록하기만 하면 됩니다.

등록 예시:
    from shared.auth.router import auth_router
    app.include_router(auth_router, prefix="/auth", tags=["인증"])

API 엔드포인트:
    POST /auth/register  - 회원가입
    POST /auth/login     - 로그인
    GET  /auth/me        - 내 정보 조회
    PUT  /auth/me        - 내 정보 수정
"""
import os
from fastapi import APIRouter, Depends, Request, Header
from sqlalchemy.orm import Session
from typing import Optional

from shared.auth.schemas import (
    UserRegisterRequest, UserLoginRequest,
    TokenResponse, UserResponse, UserUpdateRequest,
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


def get_current_user_dependency(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """JWT 토큰에서 현재 로그인 사용자를 추출하는 의존성"""
    from fastapi import HTTPException
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다.")

    token = authorization.replace("Bearer ", "").strip()
    settings = _get_jwt_settings(request)

    payload = decode_access_token(token, settings.JWT_SECRET, settings.JWT_ALGORITHM)
    if not payload:
        raise HTTPException(status_code=401, detail="유효하지 않거나 만료된 토큰입니다.")

    user_id = payload.get("sub")
    
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True,
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


def _resolve_app_id(request: Request) -> str:
    app_id = getattr(request.state, "app_id", None)
    if not app_id:
        app_id = getattr(request.state, "x_app_id", None)
    if not app_id:
        app_id = request.headers.get("x-app-id") or request.query_params.get("app_id")
    return app_id or "studycafe"


@auth_router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    request: Request,
    body: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """회원가입 (모든 앱 공통)"""
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
    """로그인 (모든 앱 공통)"""
    service = _get_auth_service(request)
    app_id = _resolve_app_id(request)
    return await service.login(db, body, app_id)


@auth_router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user_dependency),
):
    """내 정보 조회 (모든 앱 공통)"""
    return UserResponse(**current_user.to_dict())


@auth_router.get("/health", include_in_schema=False)
async def auth_health():
    return {"status": "auth service running"}
