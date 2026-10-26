import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from apps.store.backend.db.database import get_db
from apps.store.backend.db import models
from apps.store.backend.schemas import OrderCreate, OrderResponse
from apps.store.backend.services.mqtt_handler import mqtt_handler

router = APIRouter(prefix="/api/orders", tags=["POS Orders"])

@router.post("/", response_model=OrderResponse)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="주문 품목이 없습니다.")

    total = sum(item.price * item.quantity for item in payload.items)
    order_num = f"ORD-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    order = models.Order(
        order_number=order_num,
        total_amount=total,
        payment_method=payload.payment_method,
        status="COMPLETED"
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    for item in payload.items:
        db_item = models.OrderItem(
            order_id=order.id,
            product_name=item.product_name,
            quantity=item.quantity,
            price=item.price
        )
        db.add(db_item)
        # Deduct stock if product exists
        prod = db.query(models.Product).filter(models.Product.name == item.product_name).first()
        if prod:
            prod.stock_quantity = max(0, prod.stock_quantity - item.quantity)

    db.commit()
    mqtt_handler.trigger_pos_receipt_print(order_num)
    return order

@router.get("/", response_model=list[OrderResponse])
def list_orders(db: Session = Depends(get_db)):
    return db.query(models.Order).order_by(models.Order.created_at.desc()).limit(50).all()
