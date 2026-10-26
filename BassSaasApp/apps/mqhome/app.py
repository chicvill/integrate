"""apps/mqhome/app.py — 브랜드 홈페이지 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp

router = APIRouter()


@router.get("/status")
def status():
    return {"success": True, "app_id": "mqhome", "status": "HEALTHY"}


class MQHomeApp(BaseSaaSApp):
    app_id = "mqhome"
    app_name = "MQnet 브랜드 홈페이지"
    icon = "🌐"
    category = "portal"
    description = "MQnet 혁신 IT 솔루션 브랜드 소개 및 통합 제품 쇼케이스"
    version = "1.0.0"
    features = ["브랜드 스토리", "전체 라인업", "인터랙티브 파티클 디자인"]
    subdomains = ["home.localhost"]
    order = 5

    def get_router(self) -> APIRouter:
        return router


app_instance = MQHomeApp()
