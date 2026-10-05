"""
shared/auth/service.py
공통 인증 비즈니스 로직.
"""
import os
import logging
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from shared.auth.models import User
from shared.auth.schemas import UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse
from shared.utils.security import hash_password, verify_password, create_access_token

logger = logging.getLogger("mqnet.auth")


class AuthService:
    def __init__(self, jwt_secret: str, jwt_algorithm: str = "HS256", jwt_expire_minutes: int = 1440):
        self.jwt_secret = jwt_secret
        self.jwt_algorithm = jwt_algorithm
        self.jwt_expire_minutes = jwt_expire_minutes

    def _build_user_response(self, user: User) -> UserResponse:
        d = user.to_dict()
        return UserResponse(
            id=d["id"],
            email=d["email"],
            full_name=d["full_name"],
            fullName=d["full_name"],
            phone=d["phone"],
            role=d["role"],
            app_id=d["app_id"],
            tenant_id=d["tenant_id"],
            tenantId=d["tenant_id"],
            plan_id=d["plan_id"],
            planId=d["plan_id"],
            billing_status=d["billing_status"],
            billingStatus=d["billing_status"],
            is_active=d["is_active"],
            is_verified=d["is_verified"],
            created_at=user.created_at,
        )

    def seed_default_users(self, db: Session, app_id: str = "ai_gwansang"):
        """기본 데모 계정 자동 생성"""
        existing = db.query(User).filter(User.email == "hong@example.com").first()
        if not existing:
            demo_user = User(
                email="hong@example.com",
                hashed_password=hash_password("password123"),
                full_name="홍길동",
                role="admin",
                app_id=app_id,
                tenant_id="demo-office",
                plan_id="starter",
                billing_status="trial",
            )
            db.add(demo_user)
            db.commit()
            logger.info("기본 데모 사용자 (hong@example.com) 생성 완료")

    async def register(
        self,
        db: Session,
        request: UserRegisterRequest,
        app_id: str,
        role: str = "user",
    ) -> UserResponse:
        # 이메일 중복 확인
        existing = db.query(User).filter(
            User.email == request.email,
        ).first()

        if existing:
            raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다.")

        user = User(
            email=request.email,
            hashed_password=hash_password(request.password),
            full_name=request.get_name(),
            phone=request.phone,
            role=role,
            app_id=app_id,
            tenant_id=request.get_tenant_id() or "demo-office",
            plan_id="starter",
            billing_status="trial",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"[{app_id}] 회원가입 성공: {user.email}")
        return self._build_user_response(user)

    async def login(
        self,
        db: Session,
        request: UserLoginRequest,
        app_id: str,
    ) -> TokenResponse:
        # 기본 데모 계정이 없는 경우 시딩
        self.seed_default_users(db, app_id)

        user = db.query(User).filter(
            User.email == request.email,
            User.is_active == True,
        ).first()

        if not user or not verify_password(request.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

        token_data = {
            "sub": user.id,
            "email": user.email,
            "app_id": app_id,
            "role": user.role,
            "tenant_id": user.tenant_id,
            "plan_id": user.plan_id,
        }

        token = create_access_token(
            data=token_data,
            secret_key=self.jwt_secret,
            algorithm=self.jwt_algorithm,
            expires_minutes=self.jwt_expire_minutes,
        )

        user_resp = self._build_user_response(user)
        logger.info(f"[{app_id}] 로그인 성공: {user.email}")
        return TokenResponse(
            access_token=token,
            token=token,
            expires_in=self.jwt_expire_minutes * 60,
            user=user_resp,
        )