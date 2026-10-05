"""apps/selfstudy/backend/routers/ai_router.py - 자기주도학습 Gemini AI 플래너 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from shared.core.base_database import get_db
from apps.selfstudy.backend.models import AIFeedback
from apps.selfstudy.backend.config import get_settings
from apps.selfstudy.backend.db.selfstudy_ai_service import SelfStudyAIService
import uuid

router = APIRouter()


class GeneratePlanRequest(BaseModel):
    subject: str = "수학"
    target: str = "수능 1등급 / 미적분 개념완성"
    daily_minutes: Optional[int] = 60
    student_id: Optional[str] = "demo-student"


@router.post("/generate-plan", summary="Gemini AI 맞춤형 주간 학습 플랜 생성")
async def generate_ai_plan(
    body: GeneratePlanRequest,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    service = SelfStudyAIService(api_key=settings.GEMINI_API_KEY)
    
    plan_result = await service.generate_smart_plan(
        subject=body.subject,
        target=body.target,
        daily_minutes=body.daily_minutes or 60,
    )

    # DB에 AI 피드백/플랜 이력 저장
    feedback = AIFeedback(
        id=str(uuid.uuid4()),
        student_id=body.student_id or "demo-student",
        plan_id=body.subject,
        feedback_type="ai_generated_plan",
        feedback_content=str(plan_result.get("weeklyRoutine")),
        recommendation=plan_result.get("mentorAdvice"),
        generated_by="gemini-2.5-flash",
    )
    db.add(feedback)
    db.commit()

    return {
        "success": True,
        "subject": body.subject,
        "target": body.target,
        "ai_plan": plan_result,
        "feedback_id": feedback.id,
    }


class AskMentorRequest(BaseModel):
    question: str
    subject: Optional[str] = "전과목"
    student_id: Optional[str] = "demo-student"


@router.post("/ask-mentor", summary="Gemini AI 1:1 학습 멘토 Q&A")
@router.post("/ask", summary="Gemini AI 1:1 학습 멘토 Q&A (호환용)")
async def ask_study_mentor(
    body: AskMentorRequest,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    service = SelfStudyAIService(api_key=settings.GEMINI_API_KEY)
    
    mentor_res = await service.ask_study_mentor(
        question=body.question,
        subject=body.subject or "전과목",
        student_id=body.student_id or "demo-student",
    )

    answer_text = mentor_res.get("answer", "")
    tip_text = mentor_res.get("studyTip", "")
    cheer_text = mentor_res.get("encouragement", "")
    full_reply = answer_text
    if tip_text:
        full_reply += f"\n\n💡 팁: {tip_text}"
    if cheer_text:
        full_reply += f"\n💪 {cheer_text}"

    feedback = AIFeedback(
        id=str(uuid.uuid4()),
        student_id=body.student_id or "demo-student",
        plan_id=body.subject or "qa_mentor",
        feedback_type="qa_mentor",
        question=body.question,
        answer=answer_text,
        feedback_content=f"Q: {body.question}\nA: {answer_text}",
        recommendation=tip_text,
        generated_by="gemini-2.5-flash",
    )
    db.add(feedback)
    db.commit()

    return {
        "success": True,
        "question": body.question,
        "subject": body.subject,
        "reply": full_reply,
        "message": full_reply,
        "answer": answer_text,
        "mentor_response": mentor_res,
        "feedback_id": feedback.id,
    }


class AnalyzePerformanceRequest(BaseModel):
    total_minutes: int = 180
    session_count: int = 3
    avg_score: float = 4.5
    streak_days: int = 3
    student_id: Optional[str] = "demo-student"


@router.post("/analyze-performance", summary="Gemini AI 학습 성취도 피드백 리포트 생성")
async def analyze_performance(
    body: AnalyzePerformanceRequest,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    service = SelfStudyAIService(api_key=settings.GEMINI_API_KEY)

    report = await service.analyze_study_performance(
        total_minutes=body.total_minutes,
        session_count=body.session_count,
        avg_score=body.avg_score,
        streak_days=body.streak_days,
    )

    feedback = AIFeedback(
        id=str(uuid.uuid4()),
        student_id=body.student_id or "demo-student",
        plan_id="performance_analysis",
        feedback_type="performance_analysis",
        feedback_content=report.get("summary", ""),
        recommendation=report.get("actionPlan", ""),
        generated_by="gemini-2.5-flash",
    )
    db.add(feedback)
    db.commit()

    return {
        "success": True,
        "student_id": body.student_id,
        "report": report,
        "feedback_id": feedback.id,
    }
