"""
apps/selfstudy/backend/routers/onboarding_router.py
MQstudy 온보딩 & AI 캘린더 스케줄러 빌더 라우터.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uuid
import random
import string
import datetime

from shared.core.base_database import get_db
from shared.core.base_config import BaseConfig
from apps.selfstudy.backend.models import StudyChatSession, UserProfile, StudyKnowledgeBundle, StudyUser
from apps.selfstudy.backend.scheduler import Scheduler
from apps.selfstudy.backend.ai_engine import SelfStudyAIEngine
from apps.selfstudy.backend.config import get_settings

router = APIRouter()
scheduler = Scheduler()


class GoalPayload(BaseModel):
    tags: List[str] = ["일반목표"]
    goal_details: Dict[str, Any]


class FormOnboardPayload(BaseModel):
    session_id: str
    form_data: Dict[str, Any]
    user_name: Optional[str] = "학생"


@router.post("/goal", summary="목표 등록 및 AI 캘린더 생성")
async def create_goal_and_schedule(
    payload: GoalPayload,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    ai_engine = SelfStudyAIEngine(api_key=settings.GEMINI_API_KEY)
    
    goal_id = f"kb_goal_{uuid.uuid4().hex[:8]}"
    kb_goal = StudyKnowledgeBundle(
        id=goal_id,
        domain_type="GoalSetting",
        tags=payload.tags,
        payload=payload.goal_details
    )
    db.add(kb_goal)
    db.commit()

    generated_schedule = await ai_engine.generate_rag_curriculum(payload.goal_details, payload.tags)
    observer_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
    generated_schedule["ref_goal_id"] = goal_id
    generated_schedule["observer_code"] = observer_code

    kb_schedule = StudyKnowledgeBundle(
        id=schedule_id,
        domain_type="StudySchedule",
        tags=payload.tags + ["초기스케줄", f"obs_{observer_code}"],
        payload=generated_schedule
    )
    db.add(kb_schedule)
    db.commit()

    return {
        "status": "success",
        "message": "목표 및 AI 주간 캘린더가 생성되었습니다.",
        "goal_id": goal_id,
        "schedule_id": schedule_id,
        "observer_code": observer_code,
        "generated_schedule": generated_schedule
    }


@router.post("/form_onboard", summary="질문지 기반 온보딩 & AI 초안 스케줄 생성")
async def onboard_via_form(
    payload: FormOnboardPayload,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    ai_engine = SelfStudyAIEngine(api_key=settings.GEMINI_API_KEY)
    
    user_name = payload.user_name or payload.form_data.get("name") or "학생"
    user_id = f"user_{uuid.uuid4().hex[:6]}"
    tags = ["대화형온보딩", payload.form_data.get("목표", "기본목표")]

    ai_draft = await ai_engine.generate_rag_curriculum(payload.form_data, tags)
    draft = scheduler.calculate_schedule(payload.form_data, ai_draft)

    ai_greeting = f"작성해주신 질문지를 바탕으로 {user_name} 님 100% 맞춤형 초안 진도표를 생성했습니다! 🎉\n\n좌측의 스케줄을 확인해 보시고, 수정하고 싶은 부분을 말씀해 주세요."
    chat_history = [
        {"role": "user", "content": f"[시스템: {user_name} 님이 맞춤형 질문지를 제출했습니다.]\n" + str(payload.form_data)},
        {"role": "assistant", "content": ai_greeting}
    ]

    session = db.query(StudyChatSession).filter(StudyChatSession.session_id == payload.session_id).first()
    if not session:
        session = StudyChatSession(
            session_id=payload.session_id,
            user_id=user_id,
            current_stage=2,
            chat_history=chat_history,
            collected_data=payload.form_data,
            draft_schedule=draft,
            is_finalized=False
        )
        db.add(session)
    else:
        session.user_id = user_id
        session.current_stage = 2
        session.chat_history = chat_history
        session.collected_data = payload.form_data
        session.draft_schedule = draft

    db.commit()

    return {
        "status": "success",
        "session_id": payload.session_id,
        "draft_schedule": draft,
        "chat_history": chat_history
    }
