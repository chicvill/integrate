"""apps/studycafe/app.py — 1세대 스터디카페 관리 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.branch_router import router as branch_router
from .backend.routers.seat_router import router as seat_router
from .backend.routers.door_router import router as door_router
from .backend.routers.ai_router import router as ai_router
from .backend.routers.ticket_router import router as ticket_router
from .backend.routers.session_router import router as session_router

router = APIRouter()
router.include_router(branch_router, prefix="/branches")
router.include_router(seat_router, prefix="/seats")
router.include_router(door_router, prefix="/door")
router.include_router(ai_router, prefix="/ai")
router.include_router(ticket_router, prefix="/tickets")
router.include_router(session_router, prefix="/sessions")


class StudyCafeApp(BaseSaaSApp):
    app_id = "studycafe"
    app_name = "스터디카페 관리 (StudyCafe v1)"
    icon = "☕"
    category = "business"
    description = "스터디카페 좌석 배치, 실시간 입퇴실 및 이용권 관리"
    version = "1.0.0"
    features = ["좌석 실시간 현황", "이용권 관리", "NFC 도어락", "QR 체크인"]
    subdomains = ["study1.localhost"]
    order = 26

    def get_router(self) -> APIRouter:
        return router


app_instance = StudyCafeApp()
