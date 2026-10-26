"""apps/ai_guide/app.py — AI 실생활 활용 실전 가이드 앱 정의서."""
from fastapi import APIRouter
from core import BaseSaaSApp

router = APIRouter()


@router.get("/status")
def status():
    return {"success": True, "app_id": "ai_guide", "status": "HEALTHY"}


class AIGuideApp(BaseSaaSApp):
    app_id = "ai_guide"
    app_name = "AI 실생활 활용 실전 가이드"
    icon = "📘"
    category = "education"
    description = "일상을 바꾸는 AI 실생활 활용 바이블 (스마트폰 & PC 5단계 실습 교재)"
    version = "1.0.0"
    features = ["스마트폰 카메라 사진 1장 루틴", "제미나이 라이브 음성 코칭", "나만의 전담 비서 Gems 구축", "A4 PDF 인쇄 최적화 매뉴얼"]
    subdomains = ["guide.localhost"]
    order = 70

    def get_router(self) -> APIRouter:
        return router


app_instance = AIGuideApp()
