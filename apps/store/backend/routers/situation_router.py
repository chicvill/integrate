"""
apps/store/backend/routers/situation_router.py
MQnet Store 매장 실시간 상황실 (Situation Room) 통합 지표 및 AI 관제 분석 라우터.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import datetime

from shared.core.base_database import get_db
from apps.store.backend.models import Order, Product, SituationLog
from apps.store.backend.services.ai_engine import StoreAIEngine
from apps.store.backend.config import get_settings

router = APIRouter()


@router.get("/metrics", summary="매장 실시간 상황실 관제 지표 및 Gemini AI 관제 분석")
async def get_situation_room_metrics(
    db: Session = Depends(get_db),
):
    settings = get_settings()
    ai_engine = StoreAIEngine(api_key=settings.GEMINI_API_KEY)

    orders = db.query(Order).all()
    sales_today = sum(o.total_amount for o in orders)
    order_count = len(orders)

    # 기본 시드 생성 (주문이 없는 경우 데모 지표 계산)
    if order_count == 0:
        sales_today = 128500.0
        order_count = 14

    low_stock = db.query(Product).filter(Product.stock_quantity < 30).all()
    low_stock_names = [p.name for p in low_stock]

    ai_analysis = await ai_engine.analyze_situation_room(
        sales_today=sales_today,
        order_count=order_count,
        low_stock_items=low_stock_names
    )

    return {
        "status": "success",
        "sales_today": sales_today,
        "order_count": order_count,
        "low_stock_count": len(low_stock),
        "low_stock_items": low_stock_names,
        "ai_analysis": ai_analysis,
        "timestamp": datetime.datetime.now().isoformat()
    }
