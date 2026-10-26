"""
apps/store/backend/routers/staff_router.py
MQnet Store 직원/점장/점주 전용 라우터.

역할별 접근 (X-Store-Role 헤더):
  STAFF   : 주방 디스플레이, 주문 완료 처리
  MANAGER : STAFF 권한 + 테이블 현황, 일일 매출 집계, 메뉴 등록
  OWNER   : MANAGER 권한 + 직원 목록, 메뉴 삭제
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from shared.core.base_database import get_db
from apps.store.backend.models import Order, KitchenTicket, StoreUser, Product

router = APIRouter()

ROLE_HIERARCHY = {"OWNER": 3, "MANAGER": 2, "STAFF": 1, "CUSTOMER": 0}


def require_role(min_role: str, x_store_role: str = Header(default="STAFF")):
    role = x_store_role.upper()
    if ROLE_HIERARCHY.get(role, 0) < ROLE_HIERARCHY.get(min_role, 99):
        raise HTTPException(
            status_code=403,
            detail=f"이 기능은 {min_role} 이상의 권한이 필요합니다. (현재: {role})"
        )
    return role


# ── 주방 디스플레이 (KDS) ────────────────────────────────────────────────────

@router.get("/kitchen", summary="주방 디스플레이 — 미결 주문 목록")
async def get_kitchen_display(db: Session = Depends(get_db),
                               x_store_role: str = Header(default="STAFF")):
    require_role("STAFF", x_store_role)
    tickets = (
        db.query(KitchenTicket)
        .filter(KitchenTicket.status.in_(["WAITING", "COOKING"]))
        .order_by(KitchenTicket.received_at.asc())
        .all()
    )
    now = datetime.datetime.now()
    return {
        "status": "success",
        "total": len(tickets),
        "tickets": [
            {
                "id": t.id,
                "order_number": t.order_number,
                "table_number": t.table_number or "카운터",
                "order_type": t.order_type,
                "items": t.items,
                "status": t.status,
                "note": t.note,
                "received_at": str(t.received_at),
                "waiting_minutes": max(0, int((now - t.received_at).total_seconds() // 60))
                    if t.received_at else 0,
            }
            for t in tickets
        ]
    }


@router.post("/kitchen/{ticket_id}/status", summary="주방 티켓 상태 변경")
async def update_kitchen_status(ticket_id: int, status: str,
                                 db: Session = Depends(get_db),
                                 x_store_role: str = Header(default="STAFF")):
    require_role("STAFF", x_store_role)
    valid = ["WAITING", "COOKING", "READY", "SERVED"]
    if status.upper() not in valid:
        raise HTTPException(status_code=400, detail=f"유효한 상태: {valid}")

    ticket = db.query(KitchenTicket).filter(KitchenTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="티켓을 찾을 수 없습니다.")

    ticket.status = status.upper()
    if status.upper() == "SERVED":
        ticket.completed_at = datetime.datetime.now()
        order = db.query(Order).filter(Order.id == ticket.order_id).first()
        if order:
            order.kitchen_status = "SERVED"
            order.status = "COMPLETED"
    db.commit()
    return {"status": "success",
            "message": f"티켓 #{ticket_id} 상태를 {status}로 변경했습니다."}


# ── 테이블 현황 ──────────────────────────────────────────────────────────────

@router.get("/tables", summary="전체 테이블 현황")
async def get_table_status(db: Session = Depends(get_db),
                            x_store_role: str = Header(default="STAFF")):
    require_role("STAFF", x_store_role)
    pending = (
        db.query(Order)
        .filter(Order.order_type == "QR_TABLE",
                Order.status.in_(["PENDING", "CONFIRMED", "PREPARING"]))
        .order_by(Order.created_at.desc())
        .all()
    )
    tables = {}
    for o in pending:
        tbl = o.table_number or "미지정"
        if tbl not in tables:
            tables[tbl] = {"table_number": tbl, "orders": [], "total": 0}
        tables[tbl]["orders"].append({
            "order_number": o.order_number,
            "status": o.status,
            "kitchen_status": o.kitchen_status,
            "total_amount": o.total_amount,
            "items": o.items,
        })
        tables[tbl]["total"] += o.total_amount

    return {"status": "success", "active_tables": len(tables),
            "tables": list(tables.values())}


# ── 주문 상태 변경 ───────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/confirm", summary="주문 확인 처리")
async def confirm_order(order_id: int, db: Session = Depends(get_db),
                         x_store_role: str = Header(default="STAFF")):
    require_role("STAFF", x_store_role)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다.")
    order.status = "CONFIRMED"
    order.kitchen_status = "COOKING"
    ticket = db.query(KitchenTicket).filter(KitchenTicket.order_id == order_id).first()
    if ticket:
        ticket.status = "COOKING"
    db.commit()
    return {"status": "success",
            "message": f"주문 {order.order_number} 확인 완료. 주방 조리 시작!"}


@router.post("/orders/{order_id}/complete", summary="주문 완료 처리")
async def complete_order(order_id: int, served_by: str = "직원",
                          db: Session = Depends(get_db),
                          x_store_role: str = Header(default="STAFF")):
    require_role("STAFF", x_store_role)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다.")
    order.status = "COMPLETED"
    order.kitchen_status = "SERVED"
    order.served_by = served_by
    db.commit()
    return {"status": "success",
            "message": f"주문 {order.order_number} 서빙 완료!"}


# ── 일일 매출 집계 (MANAGER+) ────────────────────────────────────────────────

@router.get("/daily-summary", summary="일일 매출 집계 (MANAGER+)")
async def get_daily_summary(db: Session = Depends(get_db),
                             x_store_role: str = Header(default="MANAGER")):
    require_role("MANAGER", x_store_role)
    today_start = datetime.datetime.combine(datetime.date.today(), datetime.time.min)
    orders = (
        db.query(Order)
        .filter(Order.created_at >= today_start, Order.status == "COMPLETED")
        .all()
    )
    qr = [o for o in orders if o.order_type == "QR_TABLE"]
    pos = [o for o in orders if o.order_type == "POS_COUNTER"]
    total_sales = sum(o.total_amount for o in orders)
    return {
        "status": "success",
        "date": str(datetime.date.today()),
        "total_sales": total_sales,
        "total_orders": len(orders),
        "qr_orders": {"count": len(qr), "sales": sum(o.total_amount for o in qr)},
        "pos_orders": {"count": len(pos), "sales": sum(o.total_amount for o in pos)},
        "avg_order_value": total_sales / len(orders) if orders else 0,
    }


# ── 직원 목록 (OWNER 전용) ───────────────────────────────────────────────────

@router.get("/staff-list", summary="직원 목록 조회 (OWNER 전용)")
async def get_staff_list(db: Session = Depends(get_db),
                          x_store_role: str = Header(default="OWNER")):
    require_role("OWNER", x_store_role)
    users = db.query(StoreUser).filter(StoreUser.is_active == True).all()
    if not users:
        sample = [
            StoreUser(name="김점주", role="OWNER", pin_code="1234"),
            StoreUser(name="이점장", role="MANAGER", pin_code="5678"),
            StoreUser(name="박직원", role="STAFF", pin_code="9012"),
        ]
        for u in sample:
            db.add(u)
        db.commit()
        users = db.query(StoreUser).all()

    return {
        "status": "success",
        "total": len(users),
        "staff": [{"id": u.id, "name": u.name, "role": u.role, "is_active": u.is_active}
                  for u in users]
    }


# ── 메뉴 관리 (MANAGER+) ────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    category: str = "BEVERAGE"
    price: float
    stock_quantity: int = 100
    description: Optional[str] = None


@router.post("/menu", summary="메뉴 등록 (MANAGER+)")
async def add_menu_item(payload: ProductCreate, db: Session = Depends(get_db),
                         x_store_role: str = Header(default="MANAGER")):
    require_role("MANAGER", x_store_role)
    product = Product(
        name=payload.name, category=payload.category,
        price=payload.price, stock_quantity=payload.stock_quantity,
        description=payload.description, is_active=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"status": "success", "message": f"메뉴 '{payload.name}' 등록 완료.", "id": product.id}


@router.delete("/menu/{product_id}", summary="메뉴 삭제 (OWNER 전용)")
async def delete_menu_item(product_id: int, db: Session = Depends(get_db),
                            x_store_role: str = Header(default="OWNER")):
    require_role("OWNER", x_store_role)
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    product.is_active = False
    db.commit()
    return {"status": "success", "message": f"메뉴 '{product.name}' 비활성화 완료."}

@router.patch("/menu/{product_id}/stock", summary="재고 조정 (MANAGER+)")
async def update_stock(product_id: int, quantity: int,
                        db: Session = Depends(get_db),
                        x_store_role: str = Header(default="MANAGER")):
    require_role("MANAGER", x_store_role)
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    old_qty = product.stock_quantity
    product.stock_quantity = max(0, quantity)
    db.commit()
    return {"status": "success",
            "message": f"'{product.name}' 재고: {old_qty} → {product.stock_quantity}"}
