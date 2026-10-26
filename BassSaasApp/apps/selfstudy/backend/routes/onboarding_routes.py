import uuid
import random
import string
from fastapi import APIRouter, HTTPException, BackgroundTasks
from schemas import (
    GoalPayload,
    FormOnboardPayload,
    GenSubjectsPayload,
    GenSubjectWeightsPayload,
    GenUnitsPayload,
    GenUnitWeightsPayload,
    RecommendTextbooksPayload
)
from deps import context

router = APIRouter(prefix="/knowledge", tags=["Onboarding & AI Generation"])

async def _background_rag_scheduler(goal_id: str, goal_details: dict, tags: list):
    """백그라운드에서 비동기로 실행되는 RAG 기반 일정 생성 로직"""
    print(f"[RAG] Generating curriculum for Goal: {goal_id} with tags: {tags}")
    generated_schedule = await context.ai_tutor.generate_rag_curriculum(goal_details, tags)
    
    if "error" in generated_schedule:
        print(f"[RAG ERR] {generated_schedule['error']}")
        return
        
    observer_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
    generated_schedule["ref_goal_id"] = goal_id 
    generated_schedule["observer_code"] = observer_code
    new_tags = tags + ["초기스케줄", f"obs_{observer_code}"]
    
    context.knowledge_repo.insert_knowledge(
        doc_id=schedule_id,
        domain_type="StudySchedule",
        tags=new_tags,
        payload=generated_schedule
    )
    print(f"[RAG] Successfully created StudySchedule: {schedule_id} with Observer Code: {observer_code}")

@router.post("/goal")
async def create_goal_and_schedule(payload: GoalPayload, background_tasks: BackgroundTasks):
    goal_id = f"kb_goal_{uuid.uuid4().hex[:8]}"
    success = context.knowledge_repo.insert_knowledge(
        doc_id=goal_id,
        domain_type="GoalSetting",
        tags=payload.tags,
        payload=payload.goal_details
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save goal to Knowledge Base")
        
    background_tasks.add_task(_background_rag_scheduler, goal_id, payload.goal_details, payload.tags)
    return {"status": "success", "message": "목표가 지식창고에 저장되었습니다.", "goal_id": goal_id}

@router.post("/form_onboard")
async def onboard_via_form(payload: FormOnboardPayload):
    user_id = f"user_{uuid.uuid4().hex[:6]}"
    tags = ["대화형온보딩", payload.form_data.get("goal", "기본목표")]
    ai_draft = await context.ai_tutor.generate_rag_curriculum(payload.form_data, tags)
    draft = context.scheduler.calculate_schedule(payload.form_data, ai_draft)
    
    ai_greeting = "작성해주신 질문지를 바탕으로 100% 맞춤형 초안 진도표를 생성했습니다! 🎉\n\n좌측의 스케줄을 확인해 보시고, 수정하고 싶은 부분을 우측 채팅창에 편하게 말씀해 주세요."
    chat_history = [
        {"role": "user", "content": "[시스템: 사용자가 맞춤형 질문지를 제출했습니다.]\n" + str(payload.form_data)},
        {"role": "assistant", "content": ai_greeting}
    ]
    
    context.chat_repo.save_chat_session(
        session_id=payload.session_id,
        user_id=user_id,
        current_stage=2,
        chat_history=chat_history,
        collected_data=payload.form_data,
        draft_schedule=draft,
        is_finalized=False
    )
    
    return {
        "status": "success",
        "message": "폼 기반 온보딩 완료",
        "ai_response": ai_greeting,
        "draft_schedule": draft
    }

@router.post("/generate_subjects")
async def api_generate_subjects(payload: GenSubjectsPayload):
    res = await context.ai_tutor.generate_subjects(payload.user_goal, payload.tags)
    return {"status": "success", "data": res}

@router.post("/generate_subject_weights")
async def api_generate_subject_weights(payload: GenSubjectWeightsPayload):
    res = await context.ai_tutor.generate_subject_weights(payload.subjects, payload.user_goal)
    return {"status": "success", "data": res}

@router.post("/generate_units")
async def api_generate_units(payload: GenUnitsPayload):
    res = await context.ai_tutor.generate_units(payload.subjects, payload.user_goal)
    return {"status": "success", "data": res}

@router.post("/generate_unit_weights")
async def api_generate_unit_weights(payload: GenUnitWeightsPayload):
    res = await context.ai_tutor.generate_unit_weights(payload.subjects_with_units, payload.user_goal)
    return {"status": "success", "data": res}

@router.post("/recommend_textbooks")
async def api_recommend_textbooks(payload: RecommendTextbooksPayload):
    res = await context.ai_tutor.recommend_textbooks_and_toc(payload.user_goal)
    return {"status": "success", "data": res}
