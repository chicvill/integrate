"""
apps/studycafe2/app.py — 무인 스터디카페 (스마트 객체) 앱 정의서.
"""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.api import router
from .backend.domain import bootstrap


class StudyCafe2App(BaseSaaSApp):
    app_id = "studycafe2"
    app_name = "스터디카페 (StudyCafe2)"
    icon = "☕"
    category = "business"
    description = "좌석 실시간 배치, 간편 입퇴실, 시간권/기간권 수납 및 바코드 관제 솔루션."
    version = "2.0.0"
    features = ["실시간 좌석 관제", "간편 입퇴실/외출", "시간권/기간권 발권", "키오스크 & 모바일 연동"]
    subdomains = ["studycafe.localhost", "study.localhost"]
    order = 25

    def get_router(self) -> APIRouter:
        return router

    def on_startup(self) -> None:
        bootstrap()

    def health_check(self):
        return {"status": "HEALTHY", "engine": "Kernel Obj (Document Store)"}


app_instance = StudyCafe2App()
