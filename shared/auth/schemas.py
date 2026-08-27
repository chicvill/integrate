"""
shared/auth/schemas.py
인증 관련 Pydantic 스키마 (요청/응답 데이터 모델).
"""
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime


class UserRegisterRequest(BaseModel):
    """회원가입 요청 스키마"""
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    tenant_id: Optional[str] = None  # 매장/시설 코드 (있는 경우)

    @validator("password")
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("비밀번호는 최소 6자 이상이어야 합니다.")
        return v

    @validator("full_name")
    def full_name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("이름을 입력해 주세요.")
        return v.strip()


class UserLoginRequest(BaseModel):
    """로그인 요청 스키마"""
    email: EmailStr
    password: str


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
    phone: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class PasswordResetRequest(BaseModel):
    """비밀번호 초기화 요청 스키마"""
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    """비밀번호 초기화 확인 스키마"""
    token: str
    new_password: str

    @validator("new_password")
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("비밀번호는 최소 6자 이상이어야 합니다.")
        return v


TokenResponse.model_rebuild()
