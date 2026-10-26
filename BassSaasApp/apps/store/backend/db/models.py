import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from apps.store.backend.db.database import Base

class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    address = Column(String(200), nullable=True)
    status = Column(String(20), default="OPERATIONAL") # OPERATIONAL, WARNING, CLOSED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    products = relationship("Product", back_populates="store")
    orders = relationship("Order", back_populates="store")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), default="BEVERAGE") # BEVERAGE, SNACK, GOODS
    price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, default=100)
    is_active = Column(Boolean, default=True)

    store = relationship("Store", back_populates="products")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    total_amount = Column(Float, nullable=False)
    payment_method = Column(String(20), default="CARD") # CARD, CASH, KIOSK
    status = Column(String(20), default="COMPLETED") # PENDING, COMPLETED, CANCELLED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    store = relationship("Store", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_name = Column(String(100), nullable=False)
    quantity = Column(Integer, default=1)
    price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")

class SituationLog(Base):
    """Situation Room anomaly alert & event log model"""
    __tablename__ = "situation_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False) # ANOMALY_ALERT, INVENTORY_LOW, SALES_SPIKE
    severity = Column(String(20), default="INFO") # INFO, WARNING, CRITICAL
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class StoreUser(Base):
    __tablename__ = "store_users"
    id = Column(String(36), primary_key=True)
    tenant_id = Column(String(100), default="store-main", index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(50), default="STAFF")
    pin_code = Column(String(10), nullable=True)


class StoreTable(Base):
    __tablename__ = "store_tables"
    id = Column(String(36), primary_key=True)
    tenant_id = Column(String(100), default="store-main", index=True)
    table_number = Column(String(20), nullable=False)
    capacity = Column(Integer, default=4)
    qr_code = Column(String(200), nullable=True)
    qr_short_code = Column(String(50), nullable=True)
    is_occupied = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)


class MenuItem(Base):
    __tablename__ = "store_menu_items"
    id = Column(String(36), primary_key=True)
    tenant_id = Column(String(100), default="store-main", index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), default="식사")
    price = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)


class KitchenTicket(Base):
    __tablename__ = "store_kitchen_tickets"
    id = Column(String(36), primary_key=True)
    tenant_id = Column(String(100), default="store-main", index=True)
    order_id = Column(String(36), nullable=True)
    table_number = Column(String(20), nullable=True)
    items_summary = Column(Text, nullable=True)
    status = Column(String(20), default="COOKING") # COOKING, READY, SERVED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class StoreOrder(Base):
    __tablename__ = "store_orders"
    id = Column(String(36), primary_key=True)
    tenant_id = Column(String(100), default="store-main", index=True)
    table_id = Column(String(36), nullable=True)
    table_number = Column(String(20), nullable=True)
    total_amount = Column(Integer, default=0)
    status = Column(String(20), default="COMPLETED")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

