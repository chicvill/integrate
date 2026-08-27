import datetime
from typing import Optional, List
from pydantic import BaseModel

class ProductBase(BaseModel):
    name: str
    category: str = "BEVERAGE"
    price: float
    stock_quantity: int = 100

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class OrderItemCreate(BaseModel):
    product_name: str
    quantity: int
    price: float

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    payment_method: str = "CARD"

class OrderResponse(BaseModel):
    id: int
    order_number: str
    total_amount: float
    payment_method: str
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class SituationLogResponse(BaseModel):
    id: int
    event_type: str
    severity: str
    message: str
    timestamp: datetime.datetime

    class Config:
        from_attributes = True
