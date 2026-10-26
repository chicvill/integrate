from .orders import router as order_router
from .inventory import router as inventory_router
from .situation import router as situation_router
from .table_router import router as table_router
from .menu_router import router as menu_router
from .staff_router import router as staff_router

__all__ = [
    "order_router",
    "inventory_router",
    "situation_router",
    "table_router",
    "menu_router",
    "staff_router"
]
