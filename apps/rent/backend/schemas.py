"""
apps/rent/backend/schemas.py
Pydantic v2 데이터 스키마 명세 - 원룸 임차료 관리 시스템.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ── 건물(지점) 스키마 ──
class BranchCreate(BaseModel):
    branch_id: str
    name: str
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    fee_plan: Optional[str] = "원룸 프리미엄 29실형"
    monthly_fee: Optional[int] = 150000
    billing_due_day: Optional[int] = 25


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class BranchBillingUpdate(BaseModel):
    billing_status: str
    last_paid_at: Optional[str] = None


class BranchResponse(BaseModel):
    id: str
    branch_id: str
    name: str
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    fee_plan: str
    monthly_fee: int
    billing_status: str
    billing_due_day: int
    last_paid_at: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class BranchListResponse(BaseModel):
    success: bool
    total: int
    branches: List[BranchResponse]


# ── 호실 및 계약 스키마 ──
class RoomUpdate(BaseModel):
    name: Optional[str] = ""
    id_number: Optional[str] = ""
    phone: Optional[str] = ""
    lease_type: Optional[str] = "월세"
    pay_timing: Optional[str] = "후불"
    deposit: Optional[int] = 5000000
    rent: Optional[int] = 400000
    maintenance: Optional[int] = 50000
    clean_fee: Optional[int] = 80000
    move_in: Optional[str] = ""
    expiry: Optional[str] = ""
    move_out: Optional[str] = ""


class PaymentInfo(BaseModel):
    month: int
    year: int = 2026
    paid: bool
    paid_date: str
    rent_amount: int
    maintenance_amount: int
    note: str
    tenant_name: Optional[str] = ""
    is_previous_tenant: Optional[bool] = False


class TenantHistoryResponse(BaseModel):
    id: str
    branch_id: str
    room_number: int
    name: str
    id_number: str
    phone: str
    lease_type: str
    pay_timing: str
    deposit: int
    rent: int
    maintenance: int
    clean_fee: int
    move_in: str
    expiry: str
    move_out: str
    retention_until: str

    class Config:
        from_attributes = True


class TenantHistoryListResponse(BaseModel):
    success: bool
    total: int
    histories: List[TenantHistoryResponse]


class RoomResponse(BaseModel):
    room_number: int
    branch_id: str
    name: str
    id_number: str
    phone: str
    lease_type: str
    pay_timing: str
    deposit: int
    rent: int
    maintenance: int
    clean_fee: int
    move_in: str
    expiry: str
    move_out: str
    payments: Dict[Any, PaymentInfo] = {}

    class Config:
        from_attributes = True


class RoomListResponse(BaseModel):
    success: bool
    branch_id: str
    total_rooms: int
    selected_room: int
    rooms: Dict[int, RoomResponse]


# ── 수납 처리 스키마 ──
class PaymentProcessRequest(BaseModel):
    month: int
    year: Optional[int] = 2026
    paid_date: Optional[str] = None
    note: Optional[str] = "정상 입금"
    tenant_name: Optional[str] = None
    rent_amount: Optional[int] = None
    maintenance_amount: Optional[int] = None


# ── 지출 장부 스키마 ──
class ExpenseCreate(BaseModel):
    date: str
    item: str
    amount: int
    note: Optional[str] = ""
    receipt_type: Optional[str] = ""
    receipt_info: Optional[str] = ""


class ExpenseResponse(BaseModel):
    id: str
    branch_id: str
    date: str
    item: str
    amount: int
    note: str
    receipt_type: Optional[str] = ""
    receipt_info: Optional[str] = ""

    class Config:
        from_attributes = True


class ExpenseListResponse(BaseModel):
    success: bool
    total: int
    total_amount: int
    expenses: List[ExpenseResponse]


# ── 시스템 상태 및 인증 스키마 ──
class SystemStatusResponse(BaseModel):
    app_id: str
    app_name: str
    status: str
    deployment_mode: str
    total_rooms: int
    active_contracts: int
    vacant_rooms: int
    branches_count: int
    expenses_total: int


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class UpgradeRequestPayload(BaseModel):
    user_name: str
    contact: str
    target_branch_id: str
    reason: Optional[str] = None


class UpgradeApprovePayload(BaseModel):
    request_id: str
    action: str  # APPROVE, REJECT
    assigned_branch_id: Optional[str] = None


class VatSettingsUpdate(BaseModel):
    branch_id: str = "main"
    vat_target_rooms: List[int]


class VatSettingsResponse(BaseModel):
    success: bool
    branch_id: str
    vat_target_rooms: Optional[List[int]] = None
    message: Optional[str] = None

