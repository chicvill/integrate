from apps.studycafe.backend.routers.seat_router import router as seat_router
from apps.studycafe.backend.routers.ticket_router import router as ticket_router
from apps.studycafe.backend.routers.session_router import router as session_router
from apps.studycafe.backend.routers.door_router import router as door_router
from apps.studycafe.backend.routers.ai_router import router as ai_router
from apps.studycafe.backend.routers.selfstudy import router as studycafe_selfstudy_router
from apps.studycafe.backend.routers.auth import router as study_auth_router
from apps.studycafe.backend.routers.branch_router import router as branch_router

__all__ = [
    "seat_router", "ticket_router", "session_router", "door_router",
    "ai_router", "studycafe_selfstudy_router", "study_auth_router", "branch_router"
]



