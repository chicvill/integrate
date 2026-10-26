"""
apps/selfstudy2/app.py — 관리형 독서실/자기주도학습 (스마트 객체) 앱 정의서.
"""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.api import router
from .backend.domain import bootstrap


class SelfStudy2App(BaseSaaSApp):
    app_id = "selfstudy2"
    app_name = "관리형 독서실 (SelfStudy2)"
    icon = "📚"
    category = "education"
    description = "수험생 전용 고정석, 등하원 실시간 출결, 학부모 알림 및 멘토링 상담 솔루션."
    version = "2.0.0"
    features = ["고정석 배정", "등하원 출결 체크", "학부모 안심 리포트", "상담 및 면담 일지"]
    subdomains = ["selfstudy.localhost"]
    order = 30

    def get_router(self) -> APIRouter:
        return router

    def on_startup(self) -> None:
        bootstrap()

    def health_check(self):
        return {"status": "HEALTHY", "engine": "Kernel Obj (Document Store)"}


app_instance = SelfStudy2App()
