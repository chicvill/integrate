"""
apps/store/backend/routers/inventory_router.py
MQnet Store 상품 목록 및 재고 수량 관리 라우터.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from shared.core.base_database import get_db
from apps.store.backend.models import Product

router = APIRouter()


class ProductCreatePayload(BaseModel):
    name: str
    category: Optional[str] = "BEVERAGE"  # BEVERAGE | SNACK | GOODS
    price: float
    stock_quantity: Optional[int] = 100


@router.get("/products", summary="전체 상품 및 재고 현황 조회 (기본 상품 시드 자동생성)")
async def list_products(
    db: Session = Depends(get_db),
):
    products = db.query(Product).all()

    # 데이터 미존재 시 기본 시드 자동 생성
    if not products:
        defaults = [
            ("아메리카노", "BEVERAGE", 4500.0, 150),
            ("카페라떼", "BEVERAGE", 5000.0, 120),
            ("초코 샌드위치", "SNACK", 6500.0, 20),
            ("딸기 에이드", "BEVERAGE", 5500.0, 45),
            ("치즈 케이크", "SNACK", 7000.0, 12)
        ]
        for name, cat, price, qty in defaults:
            p = Product(name=name, category=cat, price=price, stock_quantity=qty)
            db.add(p)
        db.commit()
        products = db.query(Product).all()

    return {
        "status": "success",
        "total": len(products),
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "price": p.price,
                "stock_quantity": p.stock_quantity,
                "is_active": p.is_active
            }
            for p in products
        ]
    }


@router.post("/products", summary="새 상품 등록 및 재고 설정")
async def add_product(
    payload: ProductCreatePayload,
    db: Session = Depends(get_db),
):
    product = Product(
        name=payload.name,
        category=payload.category,
        price=payload.price,
        stock_quantity=payload.stock_quantity
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    return {
        "status": "success",
        "message": "신규 상품이 등록되었습니다.",
        "product": {
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "price": product.price,
            "stock_quantity": product.stock_quantity
        }
    }
