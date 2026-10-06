"""
templates/saas-template/backend/schemas.py
Pydantic v2 데이터 유효성 검증 모델.
다중 매장(Multi-Branch) 및 이용료 수납(Billing) 스키마를 포함합니다.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


# ── 매장(지점) & 이용료 수납 스키마 ──
class BranchBase(BaseModel):
    branch_id: str = Field(..., min_length=2, max_length=50, description="지점 고유 코드 (예: branch-main, branch-gangnam)")
    name: str = Field(..., min_length=1, max_length=100, description="매장명 (예: MQnet 본점)")
    contact_phone: Optional[str] = Field(default=None, max_length=30, description="매장 연락처")
    address: Optional[str] = Field(default=None, max_length=200, description="매장 주소")
    fee_plan: Optional[str] = Field(default="프리미엄 관리형", description="솔루션 요금제 플랜")
    monthly_fee: Optional[int] = Field(default=150000, description="월 솔루션 이용료(원)")
    billing_status: Optional[str] = Field(default="PAID", description="수납 상태 (PAID, PENDING, OVERDUE)")
    billing_due_day: Optional[int] = Field(default=25, description="월 납부 마감일")
    last_paid_at: Optional[str] = Field(default=None, description="최근 수납 일자")
    is_active: bool = Field(default=True, description="활성 여부")
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    fee_plan: Optional[str] = None
    monthly_fee: Optional[int] = None
    billing_status: Optional[str] = None
    billing_due_day: Optional[int] = None
    last_paid_at: Optional[str] = None
    is_active: Optional[bool] = None
    metadata_json: Optional[Dict[str, Any]] = None


class BranchBillingUpdate(BaseModel):
    billing_status: str = Field(..., description="갱신할 수납 상태 (PAID, PENDING, OVERDUE)")
    last_paid_at: Optional[str] = Field(default=None, description="수납 일자")


class BranchResponse(BranchBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BranchListResponse(BaseModel):
    success: bool = True
    total: int
    branches: List[BranchResponse]


# ── 아이템 스키마 (매장별 격리 지원) ──
class ItemBase(BaseModel):
    branch_id: str = Field(default="main", max_length=50, description="소속 지점/매장 코드")
    title: str = Field(..., min_length=1, max_length=200, description="아이템 명칭")
    category: str = Field(default="일반", max_length=50)
    status: str = Field(default="active", max_length=30)
    detail: Optional[str] = Field(default=None)
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    branch_id: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = None
    status: Optional[str] = None
    detail: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


class ItemResponse(ItemBase):
    id: str
    owner_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ItemListResponse(BaseModel):
    success: bool = True
    total: int
    items: List[ItemResponse]


class AiAnalysisRequest(BaseModel):
    prompt: str = Field(..., min_length=2, description="AI 분석/작업 요청 프롬프트")
    context_item_id: Optional[str] = Field(None, description="분석 대상 아이템 ID")
    branch_id: Optional[str] = Field(None, description="지점 컨텍스트 (선택)")


class SystemStatusResponse(BaseModel):
    app_id: str
    app_name: str
    status: str
    deployment_mode: str
    items_count: int
    branches_count: int
    storage_dir: str
