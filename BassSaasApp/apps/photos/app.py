"""apps/photos/app.py — 스마트 갤러리 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.gallery import router as gallery_router
from .backend.routers.ai_vision import router as ai_vision_router

router = APIRouter()
router.include_router(gallery_router)
router.include_router(ai_vision_router)


class PhotosApp(BaseSaaSApp):
    app_id = "photos"
    app_name = "스마트 갤러리 (Immich AI)"
    icon = "📸"
    category = "media"
    description = "AI 안면인식 및 위치 지도, 모바일 실시간 백업 허브"
    version = "1.0.0"
    features = ["AI 안면인식", "CLIP 시맨틱 검색", "GPS 위치지도", "모바일 자동백업"]
    subdomains = ["photos.localhost", "gallery.localhost"]
    order = 55

    def get_router(self) -> APIRouter:
        return router


app_instance = PhotosApp()
