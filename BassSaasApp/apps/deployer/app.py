"""apps/deployer/app.py — 솔루션 배포 & 패키징 센터 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.distro_router import router


class DeployerApp(BaseSaaSApp):
    app_id = "deployer"
    app_name = "솔루션 배포 & 패키징 센터"
    icon = "📦"
    category = "utility"
    description = "원하는 솔루션 앱과 데이터를 선택하여 고객 전용 클라우드/로컬 PC 독립 패키지(.ZIP) 자동 생성"
    version = "1.0.0"
    features = ["솔루션 번들링", "Docker / 온프레미스 선택", "원클릭 ZIP 생성", "자동 설치 스크립트"]
    subdomains = ["deployer.localhost"]
    order = 90

    def get_router(self) -> APIRouter:
        return router


app_instance = DeployerApp()
