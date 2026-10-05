"""
apps/store/backend/models.py
매장 전용 ORM 모델.
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float, ForeignKey, JSON, Text
from shared.core.base_database import Base, TimestampMixin


class StoreTable(Base, TimestampMixin):
    """테이블 모델"""
    __tablename__ = "store_tables"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(100), nullable=False, index=True)
    table_number = Column(String(20), nullable=False)
    capacity = Column(Integer, default=4)
    qr_code = Column(String(500), nullable=True)
    qr_short_code = Column(String(10), nullable=True, index=True)  # 6자리 난수 코드
    is_occupied = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)


class MenuItem(Base, TimestampMixin):
    """메뉴 항목 모델"""
    __tablename__ = "store_menu_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(100), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Integer, nullable=False)
    category = Column(String(100), nullable=True)
    image_url = Column(String(500), nullable=True)
    is_available = Column(Boolean, default=True)
    options = Column(JSON, nullable=True)  # {"spicy": ["mild","hot","extra hot"]}


class Order(Base, TimestampMixin):
    """주문 모델"""
    __tablename__ = "store_orders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(100), nullable=False, index=True)
    table_id = Column(String(36), ForeignKey("store_tables.id"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    order_number = Column(String(20), nullable=False)
    status = Column(String(50), default="pending")
    # status: pending | confirmed | preparing | ready | completed | cancelled
    items = Column(JSON, nullable=False)  # [{"menu_id": ..., "quantity": 2, "options": {}, "price": 9000}]
    total_amount = Column(Integer, default=0)
    payment_method = Column(String(50), nullable=True)
    payment_status = Column(String(50), default="unpaid")
    note = Column(Text, nullable=True)
