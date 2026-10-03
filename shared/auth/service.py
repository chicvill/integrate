"""
shared/auth/service.py
공통 인증 및 RBAC (역할 기반 접근 제어) 비즈니스 로직.
모든 앱의 회원가입, 로그인, OAuth 소셜 로그인, 권한 검증은 이 서비스를 통해 처리됩니다.
"""
import os
import uuid
import logging
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException

from shared.auth.models import User
from shared.auth.schemas import (
    UserRegisterRequest, UserLoginRequest, OAuthLoginRequest,
    TokenResponse, UserResponse
)
from shared.utils.security import hash_password, verify_password, create_access_token

logger = logging.getLogger("mqnet.auth")

# 사전 정의된 통합 데모 계정 맵 (역할 및 권한 사전 설정)
DEMO_ACCOUNTS_MAP = {
    "demo@mqnet.io": {
        "full_name": "홍길동 (MQnet 통합회원)",
        "role": "user",
        "allowed_apps": ["*"],
        "app_roles": {"store": "customer", "photos": "user", "files": "user"},
        "plan_id": "free",
        "tenant_id": "default",
    },
    "owner@store.io": {
        "full_name": "김점주 (매장 총괄대표)",
        "role": "owner",
        "allowed_apps": ["store", "photos", "files", "ytdownload"],
        "app_roles": {"store": "owner", "photos": "pro", "files": "pro"},
        "plan_id": "pro",
        "tenant_id": "store-gangnam-01",
    },
    "manager@store.io": {
        "full_name": "이점장 (강남점 매니저)",
        "role": "manager",
        "allowed_apps": ["store", "files"],
        "app_roles": {"store": "manager", "files": "user"},
        "plan_id": "standard",
        "tenant_id": "store-gangnam-01",
    },
    "clerk@store.io": {
        "full_name": "박점원 (POS/주문 접수)",
        "role": "staff",
        "allowed_apps": ["store"],
        "app_roles": {"store": "staff"},
        "plan_id": "free",
        "tenant_id": "store-gangnam-01",
    },
    "customer@store.io": {
        "full_name": "최고객 (단골 손님)",
        "role": "customer",
        "allowed_apps": ["store"],
        "app_roles": {"store": "customer"},
        "plan_id": "free",
        "tenant_id": "store-gangnam-01",
    },
    "student@mqnet.io": {
        "full_name": "박학생 (스터디카페 이용자)",
        "role": "user",
        "allowed_apps": ["*"],
        "app_roles": {"studycafe": "member"},
        "plan_id": "time_50h",
        "tenant_id": "studycafe-main",
    }
}


class AuthService:
    """
    공통 인증 및 인가 서비스 클래스.
    - SSO 단일 계정 및 이메일 기반 회원가입
    - Google / Naver OAuth 연동
    - 앱별 접근 허용 목록 (allowed_apps) 검증
    - 앱별 역할 (app_roles) 분기 및 RBAC 인가
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
    ) -> User:
        """
        통합 회원가입 처리.
        전역 이메일 중복 체크를 수행하고 앱별 기본 역할을 설정합니다.
        """
        # 전역 이메일 중복 확인 (SSO 단일 계정 원칙)
        existing = db.query(User).filter(User.email == request.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="이미 등록된 이메일 계정입니다. 해당 계정으로 로그인해 주세요.")

        # 기본 허용 앱 및 역할 설정
        user_allowed = ["*"]  # 기본적으로 모든 공개 앱 접근 허용
        user_app_roles = request.app_roles or {}
        if app_id and app_id not in user_app_roles:
            user_app_roles[app_id] = request.role or "user"

        user = User(
            email=request.email,
            hashed_password=hash_password(request.password),
            full_name=request.full_name,
            phone=request.phone,
            role=request.role or "user",
            auth_provider=request.auth_provider or "local",
            allowed_apps=user_allowed,
            app_roles=user_app_roles,
            app_id=app_id,
            tenant_id=request.tenant_id,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"[{app_id}] 신규 통합 회원가입 완료: {user.email} (Provider: {user.auth_provider})")
        return user

    async def login(
        self,
        db: Session,
        request: UserLoginRequest,
        app_id: str,
    ) -> TokenResponse:
        """
        로그인 처리.
        1. 계정 및 비밀번호 검증
        2. 해당 사용자의 앱 접근 권한 (allowed_apps) 검증
        3. 앱별 역할 (app_roles[app_id])을 반영한 JWT 발급
        """
        user = db.query(User).filter(User.email == request.email).first()

        # 데모 계정 자동 생성 지원 (사전 정의된 맵 활용)
        if not user and request.email in DEMO_ACCOUNTS_MAP:
            demo_meta = DEMO_ACCOUNTS_MAP[request.email]
            user = User(
                email=request.email,
                hashed_password=hash_password(request.password if request.password else "demo1234!"),
                full_name=demo_meta["full_name"],
                role=demo_meta["role"],
                auth_provider="local",
                allowed_apps=demo_meta["allowed_apps"],
                app_roles=demo_meta["app_roles"],
                app_id=app_id,
                tenant_id=demo_meta.get("tenant_id"),
                plan_id=demo_meta.get("plan_id", "free"),
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        if not user or not verify_password(request.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

        if not user.is_active:
            raise HTTPException(status_code=403, detail="비활성화된 계정입니다. 관리자에게 문의하세요.")

        # 앱 접근 허용 여부(allowed_apps) 검증
        allowed = user.allowed_apps if user.allowed_apps is not None else ["*"]
        if app_id and ("*" not in allowed) and (app_id not in allowed):
            raise HTTPException(
                status_code=403,
                detail=f"해당 계정은 [{app_id}] 앱에 대한 접근 권한이 없습니다. (허용된 앱: {', '.join(allowed)})"
            )

        # 앱별 세부 역할 결정
        app_roles = user.app_roles or {}
        effective_role = app_roles.get(app_id, user.role)

        # JWT 토큰 페이로드 생성
        token_data = {
            "sub": user.id,
            "email": user.email,
            "app_id": app_id,
            "role": effective_role,
            "allowed_apps": allowed,
            "app_roles": app_roles,
            "tenant_id": user.tenant_id,
            "plan_id": user.plan_id,
            "provider": user.auth_provider,
        }

        token = create_access_token(
            data=token_data,
            secret_key=self.jwt_secret,
            algorithm=self.jwt_algorithm,
            expires_minutes=self.jwt_expire_minutes,
        )

        logger.info(f"[{app_id}] 로그인 성공: {user.email} (역할: {effective_role})")
        return TokenResponse(
            access_token=token,
            expires_in=self.jwt_expire_minutes * 60,
            user=UserResponse(**user.to_dict()),
        )

    async def oauth_login(
        self,
        db: Session,
        req: OAuthLoginRequest,
        app_id: str,
    ) -> TokenResponse:
        """
        소셜 로그인 (Google / Naver 등) 처리.
        계정이 없으면 자동 회원가입하고, 있으면 소셜 연동 후 JWT 발급.
        """
        user = db.query(User).filter(User.email == req.email).first()

        if not user:
            # 신규 소셜 회원 자동 가입
            user = User(
                email=req.email,
                hashed_password=hash_password(str(uuid.uuid4())),
                full_name=req.full_name,
                role="user",
                auth_provider=req.provider,
                allowed_apps=["*"],
                app_roles={app_id: "user"} if app_id else {},
                app_id=app_id or "platform",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"[{app_id}] 소셜 신규 회원 가입: {user.email} via {req.provider}")
        else:
            # 기존 계정에 소셜 연동 정보 업데이트
            if not user.auth_provider or user.auth_provider == "local":
                user.auth_provider = req.provider
                db.commit()

        # 앱 접근 허용 여부 검증
        allowed = user.allowed_apps if user.allowed_apps is not None else ["*"]
        if app_id and ("*" not in allowed) and (app_id not in allowed):
            raise HTTPException(
                status_code=403,
                detail=f"해당 계정은 [{app_id}] 앱에 대한 접근 권한이 없습니다."
            )

        app_roles = user.app_roles or {}
        effective_role = app_roles.get(app_id, user.role)

        token_data = {
            "sub": user.id,
            "email": user.email,
            "app_id": app_id,
            "role": effective_role,
            "allowed_apps": allowed,
            "app_roles": app_roles,
            "tenant_id": user.tenant_id,
            "plan_id": user.plan_id,
            "provider": user.auth_provider,
        }

        token = create_access_token(
            data=token_data,
            secret_key=self.jwt_secret,
            algorithm=self.jwt_algorithm,
            expires_minutes=self.jwt_expire_minutes,
        )

        return TokenResponse(
            access_token=token,
            expires_in=self.jwt_expire_minutes * 60,
            user=UserResponse(**user.to_dict()),
        )

    async def get_current_user(self, db: Session, user_id: str, app_id: str) -> Optional[User]:
        """토큰으로 현재 사용자 조회"""
        return db.query(User).filter(
            User.id == user_id,
            User.is_active == True,
        ).first()
