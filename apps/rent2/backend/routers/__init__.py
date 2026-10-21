"""
apps/rent2/backend/routers package
"""
from .branches import router as branches_router
from .rooms import router as rooms_router
from .expenses_and_history import router as expenses_router
from .tax import router as tax_router
from .auth import router as auth_router
from .smart import router as smart_router

__all__ = [
    "branches_router",
    "rooms_router",
    "expenses_router",
    "tax_router",
    "auth_router",
    "smart_router",
]
