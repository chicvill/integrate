from apps.selfstudy.backend.routers.onboarding_router import router as onboarding_router
from apps.selfstudy.backend.routers.schedule_router import router as schedule_router
from apps.selfstudy.backend.routers.attendance_router import router as attendance_router
from apps.selfstudy.backend.routers.admin_router import router as admin_router
from apps.selfstudy.backend.routers.plan_router import router as plan_router
from apps.selfstudy.backend.routers.progress_router import router as progress_router
from apps.selfstudy.backend.routers.ai_router import router as ai_router

__all__ = [
    "onboarding_router",
    "schedule_router",
    "attendance_router",
    "admin_router",
    "plan_router",
    "progress_router",
    "ai_router"
]
