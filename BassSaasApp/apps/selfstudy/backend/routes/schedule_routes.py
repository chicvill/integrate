import uuid
import random
import string
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from schemas import (
    GenerateScheduleFinalPayload,
    ChatPayload,
    FinalizePayload,
    TaskTogglePayload,
    RescheduleAutoPayload,
    TaskVerifyPayload
)
from deps import context

router = APIRouter(prefix="/knowledge", tags=["Schedules & Verification"])

@router.post("/generate_schedule_final")
async def api_generate_schedule_final(payload: GenerateScheduleFinalPayload):
    try:
        draft = context.scheduler.calculate_schedule(payload.form_data or {}, payload.ai_draft or {})
        
        chat_history = [
            {"role": "user", "content": "[시스템: 단계별 스케줄 생성이 완료되었습니다.]"},
            {"role": "assistant", "content": "스케줄 생성이 완료되었습니다! 대시보드에서 일정을 확인하세요."}
        ]
        
        form_data = payload.form_data or {}
        user_id = form_data.get("user_id", f"user_{uuid.uuid4().hex[:6]}")
        
        goal_id = f"kb_goal_{uuid.uuid4().hex[:8]}"
        tags = ["대화형온보딩", form_data.get("목표", "기본목표")]
        context.knowledge_repo.insert_knowledge(doc_id=goal_id, domain_type="GoalSetting", tags=tags, payload=form_data)
        
        observer_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
        
        draft["ref_goal_id"] = goal_id 
        draft["observer_code"] = observer_code
        draft["session_id"] = payload.session_id
        new_tags = tags + ["최종스케줄", f"obs_{observer_code}", f"sess_{payload.session_id}"]
        
        search_tag = f"sess_{payload.session_id}"
        old_results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=5)
        for old_doc in old_results:
            if old_doc.get("payload", {}).get("status") != "superseded":
                old_doc["payload"]["status"] = "superseded"
                context.knowledge_repo.insert_knowledge(doc_id=old_doc["doc_id"], domain_type=old_doc["domain_type"], tags=old_doc["tags"], payload=old_doc["payload"])
                draft["ref_previous_schedule_id"] = old_doc["doc_id"]
                break

        context.knowledge_repo.insert_knowledge(doc_id=schedule_id, domain_type="StudySchedule", tags=new_tags, payload=draft)
        
        context.chat_repo.save_chat_session(
            session_id=payload.session_id,
            user_id=user_id,
            current_stage=3,
            chat_history=chat_history,
            collected_data=form_data,
            draft_schedule=draft,
            is_finalized=True
        )
        
        return {"status": "success", "draft_schedule": draft}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[GENERATE_SCHEDULE_FINAL ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"스케줄 생성 오류: {str(e)}")

@router.post("/chat")
async def process_chat(payload: ChatPayload, background_tasks: BackgroundTasks):
    session = context.chat_repo.get_chat_session(payload.session_id)
    
    if not session:
        user_id = f"user_{uuid.uuid4().hex[:6]}"
        session = {
            "session_id": payload.session_id,
            "user_id": user_id,
            "current_stage": 1,
            "chat_history": [],
            "collected_data": {},
            "draft_schedule": None,
            "is_finalized": False
        }
    
    val_stage = session.get("current_stage")
    current_stage = int(val_stage) if isinstance(val_stage, (int, str)) else 1
    val_history = session.get("chat_history")
    chat_history = list(val_history) if isinstance(val_history, list) else []
    collected_data = dict(session.get("collected_data") or {})
    draft_schedule = dict(session.get("draft_schedule") or {})

    if session.get("is_finalized"):
        return {"status": "success", "ai_response": "이미 확정된 일정입니다.", "current_stage": current_stage}

    user_info = context.user_repo.get_user_info(payload.session_id)
    user_name = user_info["name"] if (user_info and "name" in user_info) else ""

    ai_result = await context.chat_engine.handle_chat_message(
        session_id=payload.session_id,
        current_stage=current_stage,
        chat_history=chat_history,
        collected_data=collected_data,
        draft_schedule=draft_schedule,
        user_msg=payload.message,
        user_name=user_name
    )

    if "error" in ai_result:
        raise HTTPException(status_code=500, detail=ai_result["error"])

    new_history = chat_history + [
        {"role": "user", "content": payload.message},
        {"role": "assistant", "content": ai_result["ai_response"]}
    ]
    
    new_stage = ai_result.get("new_stage", current_stage)
    new_collected_data = ai_result.get("new_collected_data", session.get("collected_data", {}))
    
    if current_stage == 2 and "new_spreadsheet_data" in ai_result:
        updated_spreadsheet = ai_result["new_spreadsheet_data"]
        new_draft_schedule = context.scheduler.calculate_schedule(new_collected_data, updated_spreadsheet)
    else:
        new_draft_schedule = ai_result.get("new_draft_schedule", session.get("draft_schedule"))

    if current_stage == 1 and new_stage == 2:
        tags = ["대화형온보딩", new_collected_data.get("목표", "기본목표")]
        ai_draft = await context.ai_tutor.generate_rag_curriculum(new_collected_data, tags)
        new_draft_schedule = context.scheduler.calculate_schedule(new_collected_data, ai_draft)
        ai_result["ai_response"] += "\n\n🎉 목표가 파악되었습니다! 화면 좌측에 AI가 생성한 '초안 일정'을 띄워드렸어요."

    context.chat_repo.save_chat_session(
        session_id=payload.session_id,
        user_id=str(session.get("user_id", "")),
        current_stage=int(new_stage),
        chat_history=new_history,
        collected_data=dict(new_collected_data),
        draft_schedule=new_draft_schedule,
        is_finalized=False
    )

    return {
        "status": "success",
        "ai_response": ai_result["ai_response"],
        "current_stage": new_stage,
        "collected_data": new_collected_data,
        "draft_schedule": new_draft_schedule
    }

@router.get("/chat/{session_id}")
async def get_chat_session_info(session_id: str):
    session = context.chat_repo.get_chat_session(session_id)
    if session:
        return {"status": "success", "data": session}
    else:
        return {"status": "success", "data": None}

@router.post("/finalize")
async def finalize_schedule(payload: FinalizePayload):
    session = context.chat_repo.get_chat_session(payload.session_id)
    if not session or not session.get("draft_schedule"):
        raise HTTPException(status_code=400, detail="확정할 스케줄이 존재하지 않습니다.")

    draft = session["draft_schedule"]
    collected = session["collected_data"]
    
    goal_id = f"kb_goal_{uuid.uuid4().hex[:8]}"
    tags = ["대화형온보딩", collected.get("목표", "기본목표")]
    context.knowledge_repo.insert_knowledge(doc_id=goal_id, domain_type="GoalSetting", tags=tags, payload=collected)
    
    observer_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
    
    draft["ref_goal_id"] = goal_id 
    draft["observer_code"] = observer_code
    draft["session_id"] = payload.session_id
    new_tags = tags + ["최종스케줄", f"obs_{observer_code}", f"sess_{payload.session_id}"]
    
    search_tag = f"sess_{payload.session_id}"
    old_results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=5)
    for old_doc in old_results:
        if old_doc.get("payload", {}).get("status") != "superseded":
            old_doc["payload"]["status"] = "superseded"
            context.knowledge_repo.insert_knowledge(doc_id=old_doc["doc_id"], domain_type=old_doc["domain_type"], tags=old_doc["tags"], payload=old_doc["payload"])
            draft["ref_previous_schedule_id"] = old_doc["doc_id"]
            break

    context.knowledge_repo.insert_knowledge(doc_id=schedule_id, domain_type="StudySchedule", tags=new_tags, payload=draft)
    
    session["current_stage"] = 3
    session["is_finalized"] = True
    context.chat_repo.save_chat_session(
        session_id=payload.session_id,
        user_id=session.get("user_id", ""),
        current_stage=3,
        chat_history=session.get("chat_history", []),
        collected_data=collected,
        draft_schedule=draft,
        is_finalized=True
    )

    return {
        "status": "success",
        "message": "스케줄이 최종 확정되어 지식창고에 저장되었습니다.",
        "schedule_id": schedule_id,
        "observer_code": observer_code,
        "final_schedule": draft
    }

@router.get("/student/{session_id}")
async def get_student_active_schedule(session_id: str):
    search_tag = f"sess_{session_id}"
    results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=10)
    for doc in results:
        if doc.get("payload", {}).get("status") != "superseded":
            return {"status": "success", "data": doc}
    return {"status": "success", "data": None}

@router.get("/observer/{code}")
async def get_schedule_by_observer_code(code: str):
    search_tag = f"obs_{code.strip().upper()}"
    results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=1)
    if results:
        return {"status": "success", "data": results[0]}
    else:
        raise HTTPException(status_code=404, detail="해당 관찰자 코드로 등록된 최신 진도표를 찾을 수 없습니다.")

@router.patch("/schedule/{schedule_id}/task")
async def update_task_status(schedule_id: str, payload: TaskTogglePayload):
    doc = context.knowledge_repo.get_knowledge(schedule_id)
    if not doc:
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다.")

    payload_data = doc.get("payload", {})
    curriculum = payload_data.get("curriculum", [])

    week_found = False
    for week in curriculum:
        if week.get("week_number") == payload.week_number:
            week_found = True
            tasks = week.get("daily_tasks", [])
            if 0 <= payload.task_index < len(tasks):
                tasks[payload.task_index]["completed"] = payload.completed
            else:
                raise HTTPException(status_code=400, detail="유효하지 않은 태스크 인덱스입니다.")
            break

    if not week_found:
        raise HTTPException(status_code=400, detail="유효하지 않은 주차 번호입니다.")

    success = context.knowledge_repo.insert_knowledge(
        doc_id=schedule_id,
        domain_type=doc.get("domain_type", "StudySchedule"),
        tags=doc.get("tags", []),
        payload=payload_data
    )

    if success:
        return {"status": "success", "message": "태스크 상태가 업데이트되었습니다."}
    else:
        raise HTTPException(status_code=500, detail="태스크 상태 업데이트 실패")

@router.post("/schedule/reschedule_auto")
async def reschedule_auto(payload: RescheduleAutoPayload):
    search_tag = f"sess_{payload.session_id}"
    results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=5)
    
    active_doc = None
    for doc in results:
        if doc.get("payload", {}).get("status") != "superseded":
            active_doc = doc
            break
            
    if not active_doc:
        raise HTTPException(status_code=404, detail="재조정할 활성화된 스케줄을 찾을 수 없습니다.")

    old_schedule = active_doc.get("payload", {})
    form_data = context.user_repo.get_user_profile(payload.session_id) or {}
    
    new_schedule = context.scheduler.reschedule_auto(form_data, old_schedule)
    
    active_doc["payload"]["status"] = "superseded"
    context.knowledge_repo.insert_knowledge(
        doc_id=active_doc["doc_id"],
        domain_type=active_doc["domain_type"],
        tags=active_doc["tags"],
        payload=active_doc["payload"]
    )
    
    new_schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
    observer_code = old_schedule.get("observer_code", ''.join(random.choices(string.ascii_uppercase + string.digits, k=6)))
    new_schedule["ref_previous_schedule_id"] = active_doc["doc_id"]
    new_schedule["observer_code"] = observer_code
    new_schedule["session_id"] = payload.session_id
    
    tags = ["대화형온보딩", form_data.get("목표", "기본목표"), "최종스케줄", f"obs_{observer_code}", f"sess_{payload.session_id}"]
    
    context.knowledge_repo.insert_knowledge(
        doc_id=new_schedule_id,
        domain_type="StudySchedule",
        tags=tags,
        payload=new_schedule
    )
    
    return {
        "status": "success",
        "message": "밀린 일정이 자동으로 오늘부터 남은 기간에 재배정되었습니다!",
        "new_schedule_id": new_schedule_id,
        "new_schedule": new_schedule
    }

@router.post("/task_verify")
async def api_task_verify(payload: TaskVerifyPayload):
    doc_id = f"kb_verify_{uuid.uuid4().hex[:8]}"
    tags = ["학습검증", f"sess_{payload.session_id}"]
    verify_data = {
        "session_id": payload.session_id,
        "task_title": payload.task_title,
        "one_line_summary": payload.one_line_summary,
        "actual_minutes": payload.actual_minutes,
        "timestamp": datetime.now().isoformat()
    }
    context.knowledge_repo.insert_knowledge(doc_id=doc_id, domain_type="TaskVerification", tags=tags, payload=verify_data)
    return {"status": "success", "data": verify_data}
