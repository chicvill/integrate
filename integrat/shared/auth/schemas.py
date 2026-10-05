"""
shared/auth/schemas.py
인증 관련 Pydantic 스키마 (요청/응답 데이터 모델).
CamelCase와 snake_case 모두 완벽 호환 지원.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    fullName: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    tenant_id: Optional[str] = None
    tenantId: Optional[str] = None

    def get_name(self) -> str:
        return self.full_name or self.fullName or self.name or "사용자"

    def get_tenant_id(self) -> Optional[str]:
        return self.tenant_id or self.tenantId


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_id: Optional[str] = None
    tenantId: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    fullName: Optional[str] = None
    phone: Optional[str] = None
    role: str
    app_id: str
    tenant_id: Optional[str] = None
    tenantId: Optional[str] = None
    plan_id: str
    planId: Optional[str] = None
    billing_status: str
    billingStatus: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token: str  # 프론트엔드 직접 호환용
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None