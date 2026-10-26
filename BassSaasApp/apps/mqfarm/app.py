"""apps/mqfarm/app.py — 스마트팜 센서 관제 앱 정의서."""
import os
from typing import Optional
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.sensors import router as sensor_router
from .backend.routers.actuators import router as actuator_router
from .backend.routers.growth import router as growth_router

router = APIRouter()
router.include_router(sensor_router, prefix="/sensors")
router.include_router(actuator_router, prefix="/controls")
router.include_router(growth_router, prefix="/growth")


class MQFarmApp(BaseSaaSApp):
    app_id = "mqfarm"
    app_name = "스마트팜 센서 관제 (MQFarm)"
    icon = "🌿"
    category = "iot"
    description = "스마트팜 IoT 센서 모니터링 및 장치 제어, AI 이상진단"
    version = "1.0.0"
    features = ["온습도 센서 모니터링", "환풍/급수 자동제어", "AI 이상감지 진단"]
    subdomains = ["farm.localhost", "mqfarm.localhost"]
    order = 35

    def get_router(self) -> APIRouter:
        return router

    def get_static_dir(self) -> Optional[str]:
        dist_dir = os.path.join(self.base_dir, "frontend", "dist")
        if os.path.isdir(dist_dir):
            return dist_dir
        return super().get_static_dir()


app_instance = MQFarmApp()
