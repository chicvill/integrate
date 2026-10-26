"""apps/files/app.py — 통합 파일 탐색기 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.files_router import router


class FilesApp(BaseSaaSApp):
    app_id = "files"
    app_name = "통합 파일 탐색기 (Files Hub)"
    icon = "📁"
    category = "utility"
    description = "클라우드 및 사내 드라이브 문서, 미디어, 대용량 파일 탐색기"
    version = "1.0.0"
    features = ["파일 브라우저", "대용량 업/다운로드", "폴더 관리", "보안 스토리지"]
    subdomains = ["file.localhost", "files.localhost"]
    order = 50

    def get_router(self) -> APIRouter:
        return router


app_instance = FilesApp()
