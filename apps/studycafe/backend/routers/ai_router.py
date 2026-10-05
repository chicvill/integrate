"""
apps/studycafe/backend/routers/ai_router.py
스터디카페 Gemini AI 학습 튜터 & 질문응답 라우터 (오리지널 studycafe 컨셉 복원).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from apps.studycafe.backend.config import get_settings
from apps.studycafe.backend.db.studycafe_ai_service import StudyCafeAIService

router = APIRouter()


class AskStudyRequest(BaseModel):
    question: str
    subject: Optional[str] = "일반"
    user_type: Optional[str] = "GENERAL"  # 'GENERAL' | 'MANAGED'
    phone: Optional[str] = None


@router.post("/ask", summary="Gemini AI 1:1 학습 튜터 질문 (오리지널 RAG 연동)")
async def ask_study_tutor(body: AskStudyRequest):
    """
    스터디카페 이용 중 공부 질문을 입력하면 Gemini AI 튜터가
    일반회원/관리형회원 맞춤형 개념 설명 및 공부 팁을 즉시 제공합니다.
    """
    settings = get_settings()
    service = StudyCafeAIService(api_key=settings.GEMINI_API_KEY)
    
    result = await service.ask_study_assistant(
        question=body.question,
        subject=body.subject or "일반",
        user_type=body.user_type or "GENERAL",
    )
    return result
