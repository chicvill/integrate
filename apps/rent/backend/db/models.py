"""
apps/rent/backend/db/models.py
SQLAlchemy 2.0 ORM 모델 - 29개실 원룸 임차료 관리 시스템.
shared.core.base_database.Base 및 TimestampMixin 상속.
"""
import uuid
from typing import Optional, Dict, Any
from sqlalchemy import String, Text, JSON, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from shared.core.base_database import Base, TimestampMixin


class RentBranch(Base, TimestampMixin):
    """원룸 건물/빌딩 (지점) 관리 모델"""
    __tablename__ = "rent_branches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    fee_plan: Mapped[str] = mapped_column(String(50), default="원룸 프리미엄 29실형")
    monthly_fee: Mapped[int] = mapped_column(Integer, default=150000)
    billing_status: Mapped[str] = mapped_column(String(30), default="PAID", index=True)
    billing_due_day: Mapped[int] = mapped_column(Integer, default=25)
    last_paid_at: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)


class RentRoom(Base, TimestampMixin):
    """호실 및 임대차 계약 상세 모델"""
    __tablename__ = "rent_rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id: Mapped[str] = mapped_column(String(50), default="main", nullable=False, index=True)
    room_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(100), default="", index=True)  # 공실일 경우 빈 문자열
    id_number: Mapped[str] = mapped_column(String(50), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    lease_type: Mapped[str] = mapped_column(String(20), default="월세", index=True)  # 월세, 전세
    pay_timing: Mapped[str] = mapped_column(String(20), default="후불", index=True)  # 선불, 후불

    deposit: Mapped[int] = mapped_column(Integer, default=5000000)
    rent: Mapped[int] = mapped_column(Integer, default=400000)
    maintenance: Mapped[int] = mapped_column(Integer, default=50000)
    clean_fee: Mapped[int] = mapped_column(Integer, default=80000)

    move_in: Mapped[str] = mapped_column(String(30), default="")
    expiry: Mapped[str] = mapped_column(String(30), default="")
    move_out: Mapped[str] = mapped_column(String(30), default="")

    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)


class RentPayment(Base, TimestampMixin):
    """월별 임차료/관리비 수납 장부 모델 (세입자별 추적 지원)"""
    __tablename__ = "rent_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id: Mapped[str] = mapped_column(String(50), default="main", nullable=False, index=True)
    room_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, default=2026, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # 1~12

    paid: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    paid_date: Mapped[str] = mapped_column(String(30), default="")
    rent_amount: Mapped[int] = mapped_column(Integer, default=0)
    maintenance_amount: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(String(200), default="")

    # 부가세 신고 및 과거 내역 추적용 세입자 정보
    tenant_name: Mapped[str] = mapped_column(String(100), default="", index=True)
    tenant_id_number: Mapped[str] = mapped_column(String(50), default="")
    is_previous_tenant: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class RentTenantHistory(Base, TimestampMixin):
    """전출자 및 이전 임대차 계약 이력 (전출 후 1년간 필수 보존 및 부가세 산출 연동)"""
    __tablename__ = "rent_tenant_histories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id: Mapped[str] = mapped_column(String(50), default="main", nullable=False, index=True)
    room_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    id_number: Mapped[str] = mapped_column(String(50), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    lease_type: Mapped[str] = mapped_column(String(20), default="월세")
    pay_timing: Mapped[str] = mapped_column(String(20), default="후불")

    deposit: Mapped[int] = mapped_column(Integer, default=5000000)
    rent: Mapped[int] = mapped_column(Integer, default=400000)
    maintenance: Mapped[int] = mapped_column(Integer, default=50000)
    clean_fee: Mapped[int] = mapped_column(Integer, default=80000)

    move_in: Mapped[str] = mapped_column(String(30), default="")
    expiry: Mapped[str] = mapped_column(String(30), default="")
    move_out: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # 전출일자
    retention_until: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # 전출일 + 1년 (법적 보존 기한)

    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)


class RentExpense(Base, TimestampMixin):
    """건물 운영 및 유지보수 지출 장부 모델"""
    __tablename__ = "rent_expenses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id: Mapped[str] = mapped_column(String(50), default="main", nullable=False, index=True)
    date: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    item: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(String(200), default="")
    receipt_type: Mapped[str] = mapped_column(String(50), default="")
    receipt_info: Mapped[str] = mapped_column(Text, default="")


class RentUpgradeRequest(Base, TimestampMixin):
    """임대관리자/실장 등업 신청 모델"""
    __tablename__ = "rent_upgrade_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_branch_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    assigned_branch_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True)  # PENDING, APPROVED, REJECTED


class RentUser(Base, TimestampMixin):
    """지점 관리자 및 회원 통합 계정 모델"""
    __tablename__ = "rent_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), default="", index=True)
    role: Mapped[str] = mapped_column(String(30), default="branch_admin", index=True)  # superadmin, branch_admin, user
    assigned_branch_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True)  # PENDING, APPROVED, REJECTED
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
