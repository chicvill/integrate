"""
apps/rent2/app.py — 스마트 모바일 원룸임차 관리 앱 정의서.

BassSaasApp의 BaseSaaSApp 표준 규격을 상속받아 게이트웨이가 자동 인식 및 마운트합니다.
운영 및 비즈니스 규칙은 .agents/skills/bass-rent2-ops/SKILL.md 를 따릅니다.
"""
import os
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.api import router
from .backend.domain import bootstrap


class Rent2App(BaseSaaSApp):
    app_id = "rent2"
    app_name = "스마트 임차관리 (Rent2)"
    icon = "🏢"
    category = "business"
    description = "원룸/상가 스마트 모바일 월세 수납, 자동 문자 파싱 및 FIFO 상계 관제 솔루션."
    version = "2.0.0"
    features = ["스마트 모바일 수납", "FIFO 순차 상계", "가짜 체납 방지", "은행 입금문자 파싱", "만기/계약 알림"]
    subdomains = ["rent.localhost", "rent2.localhost"]
    order = 20

    def get_router(self) -> APIRouter:
        return router

    def on_startup(self) -> None:
        seed_file = os.path.join(self.base_dir, "backend", "seed_data.json")
        bootstrap(seed_file if os.path.exists(seed_file) else None)

    def health_check(self):
        return {"status": "HEALTHY", "engine": "Kernel Obj (Document Store)"}


app_instance = Rent2App()
