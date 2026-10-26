"""
apps/store/backend/routers/order_router.py
MQnet Store POS 및 QR 주문 라우터.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import datetime
import uuid

from shared.core.base_database import get_db
from apps.store.backend.models import Order, OrderItem, Product, StoreTable, KitchenTicket

router = APIRouter()


class OrderItemSchema(BaseModel):
    product_name: str
    quantity: int = 1
    price: float


class OrderCreatePayload(BaseModel):
    items: List[OrderItemSchema]
    payment_method: Optional[str] = "CARD"  # CARD | CASH | KIOSK
    table_number: Optional[str] = None


@router.post("/", summary="POS 및 QR 주문 생성 (재고 자동 차감 & 영수증 발급)")
@router.post("", summary="POS 및 QR 주문 생성 (재고 자동 차감 & 영수증 발급)")
async def create_order(
    payload: OrderCreatePayload,
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="주문 품목이 없습니다.")

    total = sum(item.price * item.quantity for item in payload.items)
    order_num = f"ORD-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    order = Order(
        order_number=order_num,
        total_amount=total,
        payment_method=payload.payment_method,
        status="COMPLETED",
        items=[item.dict() for item in payload.items]
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    for item in payload.items:
        db_item = OrderItem(
            order_id=order.id,
            product_name=item.product_name,
            quantity=item.quantity,
            price=item.price
        )
        db.add(db_item)

        # 재고 차감 (동일 상품 존재 시)
        prod = db.query(Product).filter(Product.name == item.product_name).first()
        if prod:
            prod.stock_quantity = max(0, prod.stock_quantity - item.quantity)

    db.commit()

    return {
        "status": "success",
        "message": f"주문 완료! 영수증({order_num})이 출력되었습니다.",
        "order_number": order_num,
        "total_amount": total,
        "payment_method": payload.payment_method,
        "items_count": len(payload.items)
    }


@router.get("/", summary="최근 POS 및 QR 주문 내역 조회")
@router.get("", summary="최근 POS 및 QR 주문 내역 조회")
async def list_orders(
    db: Session = Depends(get_db),
):
    orders = db.query(Order).order_by(Order.created_at.desc()).limit(50).all()
    return {
        "status": "success",
        "total": len(orders),
        "orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "total_amount": o.total_amount,
                "payment_method": o.payment_method,
                "status": o.status,
                "created_at": str(o.created_at),
                "items": o.items or []
            }
            for o in orders
        ]
    }


# ── 고객 QR 주문 엔드포인트 (인증 불필요) ───────────────────────────────────

class QROrderItemSchema(BaseModel):
    product_name: str
    quantity: int = 1
    price: float

class QROrderPayload(BaseModel):
    table_number: str
    items: List[QROrderItemSchema]
    note: Optional[str] = None


@router.post("/qr", summary="고객 QR 주문 (테이블 QR 스캔, 인증 불필요)")
async def create_qr_order(
    payload: QROrderPayload,
    db: Session = Depends(get_db),
):
    """고객이 테이블 QR을 스캔하여 주문하는 엔드포인트."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="주문 품목이 없습니다.")

    total = sum(item.price * item.quantity for item in payload.items)
    order_num = f"QR-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    order = Order(
        order_number=order_num,
        table_number=payload.table_number,
        order_type="QR_TABLE",
        total_amount=total,
        payment_method="QR_PAY",
        status="PENDING",
        kitchen_status="WAITING",
        items=[item.dict() for item in payload.items],
        note=payload.note
    )
    db.add(order)
    db.flush()

    # 재고 차감
    for item in payload.items:
        prod = db.query(Product).filter(Product.name == item.product_name).first()
        if prod:
            prod.stock_quantity = max(0, prod.stock_quantity - item.quantity)
        db.add(OrderItem(
            order_id=order.id,
            product_name=item.product_name,
            quantity=item.quantity,
            price=item.price
        ))

    # 주방 티켓 자동 생성 (KDS)
    kitchen_ticket = KitchenTicket(
        order_id=order.id,
        order_number=order_num,
        table_number=payload.table_number,
        order_type="QR_TABLE",
        items=[item.dict() for item in payload.items],
        status="WAITING",
        note=payload.note,
        received_at=datetime.datetime.now()
    )
    db.add(kitchen_ticket)
    db.commit()

    return {
        "status": "success",
        "message": f"주문이 접수되었습니다! 잠시 기다려 주세요.",
        "order_number": order_num,
        "table_number": payload.table_number,
        "total_amount": total,
        "estimated_wait": "5~10분",
        "items_count": len(payload.items)
    }
