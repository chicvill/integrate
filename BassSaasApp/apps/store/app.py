"""apps/store/app.py — 매장 QR 주문 & POS 앱 정의서."""
import os
from typing import Optional
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.orders import router as order_router
from .backend.routers.inventory import router as inventory_router
from .backend.routers.table_router import router as table_router
from .backend.routers.menu_router import router as menu_router
from .backend.routers.situation import router as situation_router
from .backend.routers.staff_router import router as staff_router

router = APIRouter()
router.include_router(table_router, prefix="/tables")
router.include_router(menu_router, prefix="/menu")
router.include_router(order_router, prefix="/orders")
router.include_router(inventory_router, prefix="/inventory")
router.include_router(situation_router, prefix="/situation")
router.include_router(staff_router, prefix="/staff")


class StoreApp(BaseSaaSApp):
    app_id = "store"
    app_name = "매장 QR 주문 & POS 관제"
    icon = "🍽️"
    category = "business"
    description = "테이블 비대면 QR 주문, 실시간 주방 디스플레이, 토스 결제 및 재고 관제"
    version = "1.0.0"
    features = ["테이블 QR 주문", "실시간 주방 디스플레이", "토스 결제", "메뉴 및 재고 관리"]
    subdomains = ["store.localhost"]
    order = 22

    def get_router(self) -> APIRouter:
        return router

    def get_static_dir(self) -> Optional[str]:
        dist_dir = os.path.join(self.base_dir, "frontend", "dist")
        if os.path.isdir(dist_dir):
            return dist_dir
        return super().get_static_dir()


app_instance = StoreApp()
