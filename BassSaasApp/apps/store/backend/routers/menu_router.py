"""apps/store/backend/routers/menu_router.py - 매장 메뉴 관리 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict
import uuid

from shared.core.base_database import get_db
from apps.store.backend.models import MenuItem

router = APIRouter()

SEED_MENUS = [
    {"name": "아이스 아메리카노", "price": 4500, "category": "커피", "description": "스페셜티 원두로 내린 깔끔하고 고소한 커피", "image_url": "/static/store/americano.jpg"},
    {"name": "카페 라떼", "price": 5000, "category": "커피", "description": "부드러운 스팀밀크와 에스프레소의 조화", "image_url": "/static/store/latte.jpg"},
    {"name": "바질 치킨 파니니", "price": 8500, "category": "브런치", "description": "바질 페스토와 닭가슴살, 모짜렐라 치즈 샌드위치", "image_url": "/static/store/panini.jpg"},
    {"name": "크로플 & 바닐라 아이스크림", "price": 6500, "category": "디저트", "description": "버터 풍미 가득한 바삭한 크로플과 달콤한 아이스크림", "image_url": "/static/store/croffle.jpg"},
    {"name": "자몽 에이드", "price": 5500, "category": "음료", "description": "생자몽 과즙이 톡톡 터지는 청량한 에이드", "image_url": "/static/store/ade.jpg"},
]


def _ensure_seed_menu(db: Session, tenant_id: str):
    count = db.query(MenuItem).filter(MenuItem.tenant_id == tenant_id).count()
    if count == 0:
        for item in SEED_MENUS:
            m = MenuItem(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name=item["name"],
                description=item["description"],
                price=item["price"],
                category=item["category"],
                image_url=item["image_url"],
                is_available=True,
            )
            db.add(m)
        db.commit()


@router.get("/", summary="전체 메뉴 목록 조회")
async def list_menu_items(
    tenant_id: str = "store-main",
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _ensure_seed_menu(db, tenant_id)
    query = db.query(MenuItem).filter(MenuItem.tenant_id == tenant_id)
    if category:
        query = query.filter(MenuItem.category == category)
    items = query.all()

    return {
        "tenant_id": tenant_id,
        "total": len(items),
        "items": [
            {
                "id": m.id,
                "name": m.name,
                "description": m.description,
                "price": m.price,
                "category": m.category,
                "is_available": m.is_available,
                "image_url": m.image_url,
            }
            for m in items
        ]
    }


@router.get("/ai-recommend", summary="AI 추천 메뉴 및 페어링 조합")
async def get_ai_menu_recommendation(
    item_name: str = "아이스 아메리카노",
    tenant_id: str = "store-main",
    db: Session = Depends(get_db),
):
    """Gemini AI가 특정 메뉴에 가장 잘 어울리는 추천 메뉴 조합을 분석합니다."""
    _ensure_seed_menu(db, tenant_id)
    items = db.query(MenuItem).filter(MenuItem.tenant_id == tenant_id).all()
    menu_names = [m.name for m in items]

    from apps.store.backend.config import get_settings
    from apps.store.backend.db.store_ai_service import StoreAIService
    settings = get_settings()
    service = StoreAIService(api_key=settings.GEMINI_API_KEY)

    result = await service.recommend_pairing(item_name, menu_names)
    return {
        "selected_item": item_name,
        "ai_recommendation": result,
    }


class CreateMenuItemRequest(BaseModel):
    name: str
    price: int
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    tenant_id: Optional[str] = "store-main"


@router.post("/", summary="새 메뉴 추가")
async def create_menu_item(
    body: CreateMenuItemRequest,
    db: Session = Depends(get_db),
):
    item = MenuItem(
        id=str(uuid.uuid4()),
        tenant_id=body.tenant_id,
        name=body.name,
        description=body.description,
        price=body.price,
        category=body.category,
        image_url=body.image_url,
        is_available=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"message": "메뉴가 등록되었습니다.", "item_id": item.id}
