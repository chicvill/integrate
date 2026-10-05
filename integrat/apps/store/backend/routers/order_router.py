"""apps/store/backend/routers/order_router.py - 주문 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from shared.core.base_database import get_db
from apps.store.backend.models import Order, StoreTable
from shared.utils.security import generate_short_code
import uuid, datetime, pytz

router = APIRouter()


class OrderItemSchema(BaseModel):
    menu_id: str
    quantity: int
    options: Optional[dict] = {}
    price: int


class CreateOrderRequest(BaseModel):
    table_qr_code: str  # QR 코드 또는 6자리 단축 코드
    items: List[OrderItemSchema]
    note: Optional[str] = None


@router.post("/", summary="QR 주문 생성 (고객용)")
async def create_order(
    body: CreateOrderRequest,
    tenant_id: str,
    db: Session = Depends(get_db),
):
    """고객이 테이블 QR을 스캔하여 주문합니다."""
    table = db.query(StoreTable).filter(
        StoreTable.qr_short_code == body.table_qr_code,
        StoreTable.tenant_id == tenant_id,
    ).first()
    
    if not table:
        raise HTTPException(status_code=404, detail="유효하지 않은 QR 코드입니다.")

    order_number = generate_short_code(8)
    total = sum(item.price * item.quantity for item in body.items)

    order = Order(
        tenant_id=tenant_id,
        table_id=table.id,
        order_number=order_number,
        items=[item.dict() for item in body.items],
        total_amount=total,
        note=body.note,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return {"order_id": order.id, "order_number": order_number, "total": total, "status": "pending"}


@router.get("/", summary="주문 목록 조회 (주방/관리자용)")
async def get_orders(
    tenant_id: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """주방 디스플레이나 관리자용 주문 목록"""
    query = db.query(Order).filter(Order.tenant_id == tenant_id)
    if status:
        query = query.filter(Order.status == status)
    orders = query.order_by(Order.created_at.desc()).limit(100).all()
    return orders
