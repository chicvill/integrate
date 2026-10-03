"""
shared/auth/schemas.py
인증 관련 Pydantic 스키마 (요청/응답 데이터 모델).
"""
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class UserRegisterRequest(BaseModel):
    """회원가입 요청 스키마"""
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    tenant_id: Optional[str] = None  # 매장/시설 코드 (있는 경우)
    role: Optional[str] = "user"     # 기본 역할 (user, owner, manager, staff, customer 등)
    auth_provider: Optional[str] = "local" # local, google, naver
    app_roles: Optional[Dict[str, str]] = None # 앱별 역할 (예: {"store": "manager"})

    @validator("password")
    def password_min_length(cls, v):
        if len(v) < 4:
            raise ValueError("비밀번호는 최소 4자 이상이어야 합니다.")
        return v

    @validator("full_name")
    def full_name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("이름을 입력해 주세요.")
        return v.strip()


class UserLoginRequest(BaseModel):
    """로그인 요청 스키마 (ID 또는 이메일)"""
    email: str
    password: str


class OAuthLoginRequest(BaseModel):
    """소셜 로그인(Google, Naver 등) 요청 스키마"""
    provider: str  # "google" | "naver"
    auth_code_or_token: str  # 소셜 Access Token 또는 Auth Code
    email: EmailStr
    full_name: str
    avatar_url: Optional[str] = None
    app_id: Optional[str] = None


class TokenResponse(BaseModel):
    """로그인 성공 응답 스키마"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # 만료 시간 (초)
    user: "UserResponse"


class UserResponse(BaseModel):
    """사용자 정보 응답 스키마 (비밀번호 제외)"""
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    auth_provider: str = "local"
    allowed_apps: List[str] = ["*"]
    app_roles: Dict[str, str] = {}
    app_id: str
    tenant_id: Optional[str] = None
    plan_id: str
    billing_status: str
    is_active: bool
    is_verified: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    """사용자 정보 수정 요청 스키마"""
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class PasswordResetRequest(BaseModel):
    """비밀번호 재설정 코드 요청 스키마 (아이디 또는 이메일)"""
    email: str


class PasswordResetConfirmRequest(BaseModel):
    """비밀번호 재설정 확인 스키마 (6자리 인증 코드 + 새 비밀번호)"""
    email: str
    code: str
    new_password: str

    @validator("new_password")
    def password_min_length(cls, v):
        if len(v) < 4:
            raise ValueError("비밀번호는 최소 4자 이상이어야 합니다.")
        return v


class WithdrawRequest(BaseModel):
    """회원 탈퇴 요청 스키마 (본인 확인용 비밀번호 + 확인 문구)"""
    password: Optional[str] = None
    confirm_text: str


TokenResponse.model_rebuild()
