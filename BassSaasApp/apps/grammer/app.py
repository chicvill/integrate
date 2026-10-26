"""apps/grammer/app.py — AI 영문법 퀘스트 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp
from .backend.routers.grammer_router import router


class GrammerApp(BaseSaaSApp):
    app_id = "grammer"
    app_name = "AI 영문법 퀘스트 (Grammar Quest)"
    icon = "🔤"
    category = "education"
    description = "초3~고3 수능 영문법 무한 생성 & AI 음성 섀도잉 발음 코칭"
    version = "1.0.0"
    features = ["STEM & AI 어휘 예문", "6단계 정규 교육과정", "음성 인식 & 섀도잉", "AI 원어민 발음 코칭"]
    subdomains = ["grammar.localhost"]
    order = 80

    def get_router(self) -> APIRouter:
        return router


app_instance = GrammerApp()
