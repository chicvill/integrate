"""
templates/saas-template/backend/db/models.py
SQLAlchemy ORM 테이블 모델. 반드시 shared.core.base_database.Base를 상속합니다.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, JSON
from shared.core.base_database import Base


class AppItem(Base):
    """표준 SaaS 관리 대상 아이템 모델"""
    __tablename__ = "{{APP_ID}}_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False, index=True)
    category = Column(String(50), default="일반", index=True)
    status = Column(String(30), default="active", index=True)  # active, completed, pending
    detail = Column(Text, nullable=True)
    metadata_json = Column(JSON, default=dict)
    
    owner_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
