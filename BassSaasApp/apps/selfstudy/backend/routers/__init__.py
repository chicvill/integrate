from .onboarding_router import router as onboarding_router
from .schedule_router import router as schedule_router
from .attendance_router import router as attendance_router
from .admin_router import router as admin_router
from .plan_router import router as plan_router
from .progress_router import router as progress_router
from .ai_router import router as ai_router

__all__ = [
    "onboarding_router",
    "schedule_router",
    "attendance_router",
    "admin_router",
    "plan_router",
    "progress_router",
    "ai_router"
]
