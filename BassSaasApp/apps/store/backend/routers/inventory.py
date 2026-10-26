from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from apps.store.backend.db.database import get_db
from apps.store.backend.db import models
from apps.store.backend.schemas import ProductCreate, ProductResponse

router = APIRouter(prefix="/api/inventory", tags=["Inventory & Products"])


@router.get("/products", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    # Seed default store products if empty
    if not products:
        defaults = [
            ("아메리카노", "BEVERAGE", 4500.0, 150),
            ("카페라떼", "BEVERAGE", 5000.0, 120),
            ("초코 샌드위치", "SNACK", 6500.0, 20),
            ("딸기 에이드", "BEVERAGE", 5500.0, 45),
            ("치즈 케이크", "SNACK", 7000.0, 12)
        ]
        for name, cat, price, qty in defaults:
            p = models.Product(name=name, category=cat, price=price, stock_quantity=qty)
            db.add(p)
        db.commit()
        products = db.query(models.Product).all()
    return products

@router.post("/products", response_model=ProductResponse)
def add_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = models.Product(
        name=payload.name,
        category=payload.category,
        price=payload.price,
        stock_quantity=payload.stock_quantity
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
