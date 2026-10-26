from apps.store.backend.routers.orders import router as order_router
from apps.store.backend.routers.inventory import router as inventory_router
from apps.store.backend.routers.situation import router as situation_router
from apps.store.backend.routers.table_router import router as table_router
from apps.store.backend.routers.menu_router import router as menu_router
from apps.store.backend.routers.staff_router import router as staff_router

__all__ = [
    "order_router",
    "inventory_router",
    "situation_router",
    "table_router",
    "menu_router",
    "staff_router"
]

