"""
apps/laundry/app.py — 앱 정의서. 게이트웨이는 이 파일 하나만 보고 앱을 자동 마운트한다.
"""
from fastapi import APIRouter

from core import BaseSaaSApp

from .backend import domain
from .backend.api import router


class LaundryApp(BaseSaaSApp):
    app_id = "laundry"
    app_name = "스마트 24시 무인빨래방"
    icon = "🧺"
    category = "business"
    description = "세탁기·건조기 실시간 현황, 코스 결제, 완료 알림과 점검 관리를 한 화면에서."
    version = "1.0.0"
    features = ["실시간 장비 보드", "정확 금액 결제 검증", "자동 완료 전환", "점검/수리 관리"]
    subdomains = ["laundry.localhost"]
    order = 10

    def get_router(self) -> APIRouter:
        return router

    def on_startup(self) -> None:
        domain.seed()

    def health_check(self):
        stats = domain.branch_stats()
        return {"machines": stats["machines"], "running": stats["by_status"].get("RUNNING", 0)}


app_instance = LaundryApp()
