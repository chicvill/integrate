"""apps/videobooth/app.py — 레트로 TV 비디오 부스 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.booth import router


class VideoBoothApp(BaseSaaSApp):
    app_id = "videobooth"
    app_name = "레트로 TV 비디오 부스"
    icon = "📺"
    category = "media"
    description = "레트로 브라운관 TV 스타일 인터랙티브 동영상 방명록 & 비디오 레코더"
    version = "1.0.0"
    features = ["실시간 웹캠 녹화", "레트로 TV 프레임", "최신 갤러리 아카이브", "TTS 음성 카운트다운"]
    subdomains = ["video.localhost"]
    order = 75

    def get_router(self) -> APIRouter:
        return router


app_instance = VideoBoothApp()
