"""apps/face_analy/app.py — 테토/에겐 AI 얼굴 분석 앱 정의서."""
import os
from typing import Optional
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.analysis import router


class FaceAnalyApp(BaseSaaSApp):
    app_id = "face_analy"
    app_name = "테토/에겐 AI 얼굴 분석"
    icon = "🧑‍🎨"
    category = "ai"
    description = "Gemini 2.5 AI 기반 테토상 vs 에겐상 얼굴 분석 및 맞춤 스타일링"
    version = "1.0.0"
    features = ["AI 얼굴형 분석", "테토/에겐 분류", "맞춤형 패션/헤어 추천", "실시간 웹캠"]
    subdomains = ["face.localhost"]
    order = 45

    def get_router(self) -> APIRouter:
        return router

    def get_static_dir(self) -> Optional[str]:
        dist_dir = os.path.join(self.base_dir, "dist")
        if os.path.isdir(dist_dir):
            return dist_dir
        return super().get_static_dir()


app_instance = FaceAnalyApp()
