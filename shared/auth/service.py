"""
shared/auth/service.py
공통 인증 비즈니스 로직.
모든 앱의 로그인/회원가입은 이 서비스를 통해 처리됩니다.
"""
import os
import logging
from typing import Optional
from sqlalchemy.orm import Session

from shared.auth.models import User
from shared.auth.schemas import UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse
from shared.utils.security import hash_password, verify_password, create_access_token

logger = logging.getLogger("mqnet.auth")


class AuthService:
    """
    공통 인증 서비스 클래스.
    각 앱은 이 클래스를 상속하여 앱별 인증 로직을 추가할 수 있습니다.
    
    상속 예시:
        class StudyCafeAuthService(AuthService):
            async def register(self, db, request, app_id):
                user = await super().register(db, request, app_id)
                # 스터디카페 전용 초기 처리 (좌석 배정 등)
                return user
    """

    def __init__(self, jwt_secret: str, jwt_algorithm: str = "HS256", jwt_expire_minutes: int = 1440):
        self.jwt_secret = jwt_secret
        self.jwt_algorithm = jwt_algorithm
        self.jwt_expire_minutes = jwt_expire_minutes

    async def register(
        self,
        db: Session,
        request: UserRegisterRequest,
        app_id: str,
        role: str = "user",
    ) -> User:
        """
        회원가입 처리.
        동일 app_id에서 동일 이메일 중복 체크를 수행합니다.
        """
        # 동일 앱 내 이메일 중복 확인
        existing = db.query(User).filter(
            User.email == request.email,
            User.app_id == app_id
        ).first()
        
        if existing:
            from fastapi import HTTPException
            raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")

        user = User(
            email=request.email,
            hashed_password=hash_password(request.password),
            full_name=request.full_name,
            phone=request.phone,
            role=role,
            app_id=app_id,
            tenant_id=request.tenant_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"[{app_id}] 회원가입 완료: {user.email}")
        return user

    async def login(
        self,
        db: Session,
        request: UserLoginRequest,
        app_id: str,
    ) -> TokenResponse:
        """
        로그인 처리.
        이메일+비밀번호 검증 후 JWT 토큰 발급.
        """
        user = db.query(User).filter(
            User.email == request.email,
            User.app_id == app_id,
            User.is_active == True,
        ).first()

        # 데모 계정 자동 생성 지원
        if not user and request.email in ["study@mqnet.io", "demo@studycafe.com", "student@mqnet.io"]:
            user = User(
                email=request.email,
                hashed_password=hash_password(request.password),
                full_name="홍길동 회원",
                phone="010-1234-5678",
                role="user",
                app_id=app_id,
                tenant_id="studycafe-main",
                plan_id="time_50h",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        if not user or not verify_password(request.password, user.hashed_password):
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

        # JWT 페이로드 구성
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

        logger.info(f"[{app_id}] 로그인 성공: {user.email}")
        return TokenResponse(
            access_token=token,
            expires_in=self.jwt_expire_minutes * 60,
            user=UserResponse(**user.to_dict()),
        )

    async def get_current_user(self, db: Session, user_id: str, app_id: str) -> Optional[User]:
        """토큰으로 현재 사용자 조회"""
        return db.query(User).filter(
            User.id == user_id,
            User.app_id == app_id,
            User.is_active == True,
        ).first()
