"""
templates/saas-template/backend/db/models.py
SQLAlchemy ORM 테이블 모델. shared.core.base_database.Base와 TimestampMixin을 상속하며 SQLAlchemy 2.0 Mapped 타입을 준수합니다.
다중 매장(Multi-Branch) 및 본사 솔루션 이용료 수납(Billing) 관리를 지원합니다.
"""
import uuid
from typing import Optional, Dict, Any
from sqlalchemy import String, Text, JSON, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from shared.core.base_database import Base, TimestampMixin


class AppBranch(Base, TimestampMixin):
    """표준 SaaS 매장(지점/가맹점) 및 수납 관리 모델"""
    __tablename__ = "{{APP_ID}}_branches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    
    # 솔루션 이용료 & 수납 상태
    fee_plan: Mapped[str] = mapped_column(String(50), default="프리미엄 관리형")
    monthly_fee: Mapped[int] = mapped_column(Integer, default=150000)
    billing_status: Mapped[str] = mapped_column(String(30), default="PAID", index=True)  # PAID, PENDING, OVERDUE
    billing_due_day: Mapped[int] = mapped_column(Integer, default=25)
    last_paid_at: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)


class AppItem(Base, TimestampMixin):
    """표준 SaaS 관리 대상 아이템 모델 (다중 매장/지점 격리 지원)"""
    __tablename__ = "{{APP_ID}}_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id: Mapped[str] = mapped_column(String(50), default="main", nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), default="일반", index=True)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)  # active, completed, pending
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    owner_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
