"""
templates/saas-template/backend/db/models.py
SQLAlchemy ORM 테이블 모델. shared.core.base_database.Base와 TimestampMixin을 상속하며 SQLAlchemy 2.0 Mapped 타입을 준수합니다.
"""
import uuid
from typing import Optional, Dict, Any
from sqlalchemy import String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from shared.core.base_database import Base, TimestampMixin


class AppItem(Base, TimestampMixin):
    """표준 SaaS 관리 대상 아이템 모델"""
    __tablename__ = "{{APP_ID}}_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), default="일반", index=True)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)  # active, completed, pending
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    
    owner_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
