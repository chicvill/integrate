import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from apps.store.backend.db.database import get_db
from apps.store.backend.db import models
from apps.store.backend.services.ai_engine import store_ai_engine

router = APIRouter(prefix="/api/situation", tags=["Situation Room"])

@router.get("/metrics")
def get_situation_room_metrics(db: Session = Depends(get_db)):
    orders = db.query(models.Order).all()
    sales_today = sum(o.total_amount for o in orders)
    order_count = len(orders)

    low_stock = db.query(models.Product).filter(models.Product.stock_quantity < 30).all()
    low_stock_names = [p.name for p in low_stock]

    ai_analysis = store_ai_engine.analyze_situation_room(
        sales_today=sales_today,
        order_count=order_count,
        low_stock_items=low_stock_names
    )

    return {
        "sales_today": sales_today,
        "order_count": order_count,
        "low_stock_count": len(low_stock),
        "low_stock_items": low_stock_names,
        "ai_analysis": ai_analysis,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
