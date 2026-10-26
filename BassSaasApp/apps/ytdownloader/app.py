"""apps/ytdownloader/app.py — 유튜브 미디어 다운로더 앱 정의서."""
import os
from typing import Optional
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.download import router as download_router
from .backend.routers.media import router as media_router

router = APIRouter()
router.include_router(download_router, prefix="/download")
router.include_router(media_router, prefix="/media")


class YTDownloaderApp(BaseSaaSApp):
    app_id = "ytdownloader"
    app_name = "유튜브 미디어 다운로더"
    icon = "🎬"
    category = "media"
    description = "YouTube 최고화질 영상/오디오 추출 및 AI 3줄 요약 리포트"
    version = "1.0.0"
    features = ["YouTube MP4/MP3 추출", "AI 영상 3줄 요약", "미디어 아카이브", "다운로드 큐"]
    subdomains = ["youtube.localhost", "ytdownloader.localhost"]
    order = 65

    def get_router(self) -> APIRouter:
        return router

    def get_static_dir(self) -> Optional[str]:
        dist_dir = os.path.join(self.base_dir, "frontend", "dist")
        if os.path.isdir(dist_dir):
            return dist_dir
        return super().get_static_dir()


app_instance = YTDownloaderApp()
