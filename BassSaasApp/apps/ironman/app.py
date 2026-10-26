"""apps/ironman/app.py — 아이언맨 제스처 게임 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp

router = APIRouter()


@router.get("/status")
def status():
    return {"success": True, "app_id": "ironman", "status": "HEALTHY"}


class IronmanApp(BaseSaaSApp):
    app_id = "ironman"
    app_name = "아이언맨 제스처 게임"
    icon = "🎮"
    category = "utility"
    description = "실시간 웹캠 핸드 트래킹 & p5.js 아이언맨 리펄서 인터랙티브 게임"
    version = "1.0.0"
    features = ["핸드 트래킹", "실시간 모션 인식", "오디오 효과음"]
    subdomains = ["ironman.localhost"]
    order = 95

    def get_router(self) -> APIRouter:
        return router


app_instance = IronmanApp()
