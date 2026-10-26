"""apps/ai_gwansang/app.py — AI 관상 분석 앱 정의서."""
import os
from typing import Optional
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.analysis_router import router


class AIGwansangApp(BaseSaaSApp):
    app_id = "ai_gwansang"
    app_name = "AI 관상 분석 (Gwansang)"
    icon = "🔮"
    category = "ai"
    description = "Gemini 2.5 AI 기반 얼굴 관상 분석 및 동물상 분류"
    version = "1.0.0"
    features = ["얼굴 관상 분석", "동물상 분류", "Gemini 2.5 Flash", "토스 결제"]
    subdomains = ["gwansang.localhost"]
    order = 40

    def get_router(self) -> APIRouter:
        return router

    def get_static_dir(self) -> Optional[str]:
        dist_dir = os.path.join(self.base_dir, "frontend", "dist")
        if os.path.isdir(dist_dir):
            return dist_dir
        return super().get_static_dir()


app_instance = AIGwansangApp()
