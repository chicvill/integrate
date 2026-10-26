"""apps/selfstudy/app.py — 1세대 자기주도학습 관리 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.plan_router import router as plan_router
from .backend.routers.progress_router import router as progress_router
from .backend.routers.ai_router import router as ai_router
from .backend.routers.onboarding_router import router as onboarding_router
from .backend.routers.schedule_router import router as schedule_router
from .backend.routers.attendance_router import router as attendance_router
from .backend.routers.admin_router import router as admin_router

router = APIRouter()
router.include_router(plan_router, prefix="/plans")
router.include_router(progress_router, prefix="/progress")
router.include_router(ai_router, prefix="/ai")
router.include_router(onboarding_router, prefix="/onboarding")
router.include_router(schedule_router, prefix="/schedule")
router.include_router(attendance_router, prefix="/attendance")
router.include_router(admin_router, prefix="/admin")


class SelfStudyApp(BaseSaaSApp):
    app_id = "selfstudy"
    app_name = "자기주도학습 관리 (SelfStudy v1)"
    icon = "📚"
    category = "education"
    description = "자기주도학습 목표, AI 플래너 및 진도 통계 리포트"
    version = "1.0.0"
    features = ["학습 플래너", "AI 멘토 피드백", "진도 통계", "학부모 리포트"]
    subdomains = ["studyplan.localhost"]
    order = 31

    def get_router(self) -> APIRouter:
        return router


app_instance = SelfStudyApp()
