from .seat_router import router as seat_router
from .ticket_router import router as ticket_router
from .session_router import router as session_router
from .door_router import router as door_router
from .ai_router import router as ai_router
from .selfstudy import router as studycafe_selfstudy_router
from .auth import router as study_auth_router
from .branch_router import router as branch_router

__all__ = [
    "seat_router", "ticket_router", "session_router", "door_router",
    "ai_router", "studycafe_selfstudy_router", "study_auth_router", "branch_router"
]
