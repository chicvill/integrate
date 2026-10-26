"""
apps/selfstudy/backend/routers/schedule_router.py
MQstudy 스케줄 관리, 진도 체크리스트, AI 리스케줄링 & 메타인지 AI 평가 챗봇 라우터.
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
from apps.selfstudy.backend.models import StudyChatSession, StudyKnowledgeBundle, StudyUser
from apps.selfstudy.backend.scheduler import Scheduler
from apps.selfstudy.backend.ai_engine import SelfStudyAIEngine
from apps.selfstudy.backend.config import get_settings

router = APIRouter()
scheduler = Scheduler()


class GenerateScheduleFinalPayload(BaseModel):
    session_id: str
    form_data: Optional[Dict[str, Any]] = {}
    ai_draft: Optional[Dict[str, Any]] = {}


class ChatPayload(BaseModel):
    session_id: str
    message: str
    user_name: Optional[str] = "학생"


class FinalizePayload(BaseModel):
    session_id: str


class TaskTogglePayload(BaseModel):
    session_id: str
    task_title: str
    date: str
    completed: bool


class RescheduleAutoPayload(BaseModel):
    session_id: str
    reason: Optional[str] = "일정 밀림"


class EvalChatPayload(BaseModel):
    session_id: str
    subject: str
    unit_name: str
    explanation: str
    user_name: Optional[str] = "학생"


@router.post("/generate_schedule_final", summary="최종 AI 캘린더 스케줄 확정 생성")
async def generate_schedule_final(
    payload: GenerateScheduleFinalPayload,
    db: Session = Depends(get_db),
):
    draft = scheduler.calculate_schedule(payload.form_data or {}, payload.ai_draft or {})
    observer_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"

    draft["observer_code"] = observer_code
    draft["session_id"] = payload.session_id

    kb_schedule = StudyKnowledgeBundle(
        id=schedule_id,
        domain_type="StudySchedule",
        tags=["최종스케줄", f"obs_{observer_code}", f"sess_{payload.session_id}"],
        payload=draft
    )
    db.add(kb_schedule)

    session = db.query(StudyChatSession).filter(StudyChatSession.session_id == payload.session_id).first()
    if session:
        session.current_stage = 3
        session.draft_schedule = draft
        session.is_finalized = True

    db.commit()
    return {"status": "success", "draft_schedule": draft, "observer_code": observer_code}


@router.post("/chat", summary="온보딩 대화형 AI 챗봇")
async def process_chat(
    payload: ChatPayload,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    ai_engine = SelfStudyAIEngine(api_key=settings.GEMINI_API_KEY)

    session = db.query(StudyChatSession).filter(StudyChatSession.session_id == payload.session_id).first()
    if not session:
        session = StudyChatSession(
            session_id=payload.session_id,
            user_id=f"user_{uuid.uuid4().hex[:6]}",
            current_stage=1,
            chat_history=[],
            collected_data={},
            is_finalized=False
        )
        db.add(session)
        db.commit()

    chat_history = session.chat_history or []
    res = await ai_engine.handle_chat_session(
        current_stage=session.current_stage,
        chat_history=chat_history,
        collected_data=session.collected_data or {},
        draft_schedule=session.draft_schedule or {},
        user_msg=payload.message,
        user_name=payload.user_name or "학생"
    )

    chat_history.append({"role": "user", "content": payload.message})
    chat_history.append({"role": "assistant", "content": res.get("ai_response")})

    session.chat_history = chat_history
    session.current_stage = res.get("new_stage", session.current_stage)
    session.collected_data = res.get("new_collected_data", session.collected_data)
    session.draft_schedule = res.get("new_draft_schedule", session.draft_schedule)

    db.commit()
    return {
        "status": "success",
        "ai_response": res.get("ai_response"),
        "stage": session.current_stage,
        "draft_schedule": session.draft_schedule
    }


@router.post("/task_toggle", summary="일일 단원 학습 완료/미완료 처리")
async def toggle_task(
    payload: TaskTogglePayload,
    db: Session = Depends(get_db),
):
    session = db.query(StudyChatSession).filter(StudyChatSession.session_id == payload.session_id).first()
    if not session or not session.draft_schedule:
        raise HTTPException(status_code=404, detail="스케줄 세션을 찾을 수 없습니다.")

    draft = session.draft_schedule
    toggled = False
    for week in draft.get("curriculum", []):
        for task in week.get("daily_tasks", []):
            if task.get("date") == payload.date and (task.get("task_title") == payload.task_title or task.get("unit_name") == payload.task_title):
                task["completed"] = payload.completed
                toggled = True

    if toggled:
        session.draft_schedule = draft
        db.commit()

    return {"status": "success", "completed": payload.completed, "draft_schedule": draft}


@router.post("/reschedule_auto", summary="진도 밀림 시 AI 지능형 리스케줄링")
async def reschedule_auto(
    payload: RescheduleAutoPayload,
    db: Session = Depends(get_db),
):
    session = db.query(StudyChatSession).filter(StudyChatSession.session_id == payload.session_id).first()
    if not session or not session.draft_schedule:
        raise HTTPException(status_code=404, detail="스케줄 세션을 찾을 수 없습니다.")

    new_draft = scheduler.reschedule_auto(session.collected_data or {}, session.draft_schedule)
    session.draft_schedule = new_draft
    db.commit()

    return {
        "status": "success",
        "message": "미완료 학습 일정이 오늘부터 마감일까지 지능적으로 재배치되었습니다.",
        "draft_schedule": new_draft
    }


@router.post("/eval_chat", summary="메타인지 AI 구술/텍스트 개념 평가")
async def evaluate_chat(
    payload: EvalChatPayload,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    ai_engine = SelfStudyAIEngine(api_key=settings.GEMINI_API_KEY)

    eval_res = await ai_engine.evaluate_student_explanation(
        subject=payload.subject,
        unit_name=payload.unit_name,
        student_explanation=payload.explanation,
        user_name=payload.user_name or "학생"
    )

    return {
        "status": "success",
        "evaluation": eval_res
    }


@router.get("/{session_id}/daily", summary="세션별 일일 진도표 및 스케줄 조회")
async def get_daily_schedule(
    session_id: str,
    db: Session = Depends(get_db),
):
    session = db.query(StudyChatSession).filter(StudyChatSession.session_id == session_id).first()
    if not session or not session.draft_schedule:
        kb = db.query(StudyKnowledgeBundle).filter(StudyKnowledgeBundle.tags.contains(f"sess_{session_id}")).first()
        if kb:
            return {"status": "success", "session_id": session_id, "draft_schedule": kb.payload}
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다.")

    return {
        "status": "success",
        "session_id": session_id,
        "is_finalized": session.is_finalized,
        "draft_schedule": session.draft_schedule
    }
