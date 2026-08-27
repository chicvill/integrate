"""
shared/auth/router.py
공통 인증 API 라우터 (React 프론트엔드 및 표준 API 전체 지원)
"""
import os
from fastapi import APIRouter, Depends, Request, Header, HTTPException
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


def _get_auth_service(request: Request) -> AuthService:
    settings = getattr(request.state, "app_settings", None)
    jwt_sec = settings.JWT_SECRET if settings else os.getenv("JWT_SECRET", "change-this-in-production")
    jwt_alg = settings.JWT_ALGORITHM if settings else "HS256"
    jwt_exp = settings.JWT_EXPIRE_MINUTES if settings else 1440
    return AuthService(jwt_secret=jwt_sec, jwt_algorithm=jwt_alg, jwt_expire_minutes=jwt_exp)


def get_current_user_dependency(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다.")

    token = authorization.replace("Bearer ", "").strip()
    jwt_secret = os.getenv("JWT_SECRET", "change-this-in-production")
    payload = decode_access_token(token, jwt_secret)
    if not payload:
        raise HTTPException(status_code=401, detail="유효하지 않거나 만료된 토큰입니다.")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


@auth_router.post("/register", response_model=UserResponse, status_code=201)
@auth_router.post("/signup", response_model=TokenResponse, status_code=201)
async def register(
    request: Request,
    body: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    service = _get_auth_service(request)
    app_id = request.headers.get("x-app-id") or getattr(request.state, "app_id", "ai_gwansang")
    user_resp = await service.register(db, body, app_id)
    # signup 요청 시에는 바로 로그인 토큰도 발급
    login_body = UserLoginRequest(email=body.email, password=body.password)
    return await service.login(db, login_body, app_id)


@auth_router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: UserLoginRequest,
    db: Session = Depends(get_db),
):
    service = _get_auth_service(request)
    app_id = request.headers.get("x-app-id") or getattr(request.state, "app_id", "ai_gwansang")
    return await service.login(db, body, app_id)


@auth_router.get("/me")
async def get_me(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user = get_current_user_dependency(request, authorization, db)
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "fullName": user.full_name,
            "full_name": user.full_name,
            "role": user.role,
            "tenantId": user.tenant_id or "demo-office",
            "tenant_id": user.tenant_id or "demo-office",
            "planId": user.plan_id or "starter",
            "planName": "Starter",
            "billingStatus": user.billing_status or "trial",
        }
    }