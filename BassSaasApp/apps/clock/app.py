"""apps/clock/app.py — 스마트 클락 앱 정의서."""
import os
from typing import Optional
from fastapi import APIRouter
from core import BaseSaaSApp

router = APIRouter()


@router.get("/status")
def status():
    return {"success": True, "app_id": "clock", "status": "HEALTHY"}


class ClockApp(BaseSaaSApp):
    app_id = "clock"
    app_name = "모던 스마트 클락"
    icon = "⏰"
    category = "utility"
    description = "네온 아날로그/디지털 듀얼 시계, 글로벌 타임존 및 뽀모도로 타이머"
    version = "1.0.0"
    features = ["아날로그/디지털 듀얼 모드", "글로벌 5대 도시 타임존", "뽀모도로 타이머"]
    subdomains = ["clock.localhost"]
    order = 60

    def get_router(self) -> APIRouter:
        return router

    def get_static_dir(self) -> Optional[str]:
        web_dir = os.path.join(self.base_dir, "web")
        return web_dir if os.path.isdir(web_dir) else super().get_static_dir()


app_instance = ClockApp()
