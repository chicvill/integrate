import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import uuid
import uvicorn
import asyncio
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

from db import DatabaseManager, UserRepository, KnowledgeRepository, ChatSessionRepository, AttendanceRepository, MessageRepository
from ai_engine import AITutor
from scheduler import Scheduler
from chat_engine import ChatEngine

class AppContext:
    def __init__(self):
        self.db_manager = DatabaseManager()
        
        # Repositories
        self.user_repo = UserRepository(self.db_manager)
        self.knowledge_repo = KnowledgeRepository(self.db_manager)
        self.chat_repo = ChatSessionRepository(self.db_manager)
        self.attendance_repo = AttendanceRepository(self.db_manager)
        self.message_repo = MessageRepository(self.db_manager)
        
        # Services & Engines
        self.ai_tutor = AITutor(self.knowledge_repo)
        self.scheduler = Scheduler()
        self.chat_engine = ChatEngine(self.ai_tutor)

    def get_latest_consult_tag(self) -> dict:
        """NFC 상담 태그 상태 조회 (DB 기반 - 프로세스 세이프)"""
        doc = self.knowledge_repo.get_knowledge("latest_consult_tag")
        if doc and doc.get("payload"):
            return doc["payload"]
        return {"session_id": "", "timestamp": 0}

    def save_latest_consult_tag(self, session_id: str, timestamp: int) -> bool:
        """NFC 상담 태그 상태 저장 (DB 기반 - 프로세스 세이프)"""
        payload = {"session_id": session_id, "timestamp": timestamp}
        return self.knowledge_repo.insert_knowledge(
            doc_id="latest_consult_tag",
            domain_type="GlobalState",
            tags=["latest_consult_tag"],
            payload=payload
        )

# Initialize context
context = AppContext()

async def keepalive_loop():
    print("[INFO] Render & Supabase Keep-Alive background task started (Interval: 5 minutes)...")
    while True:
        try:
            success = context.db_manager.ping_keepalive(1)
            if success:
                print(f"[KEEPALIVE] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Saved 1 to Supabase/DB (keepalive_ping).")
        except Exception as e:
            print(f"[KEEPALIVE ERR] {e}")
        await asyncio.sleep(300) # Every 5 minutes

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[INFO] Initializing App Context (and Knowledge Base)...")
    keepalive_task = asyncio.create_task(keepalive_loop())
    try:
        yield
    finally:
        keepalive_task.cancel()

app = FastAPI(
    title="SelfStudy Knowledge Base API",
    description="RAG 기반 비정형 목표 달성 및 스케줄러 SaaS",
    lifespan=lifespan
)

@app.get("/api/ping")
def ping():
    context.db_manager.ping_keepalive(1)
    return {"status": "ok", "keepalive": 1, "timestamp": datetime.now().isoformat()}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- BaseModels for payloads -----------------

class GoalPayload(BaseModel):
    tags: List[str]
    goal_details: dict

class FormOnboardPayload(BaseModel):
    session_id: str
    form_data: dict

class AuthPayload(BaseModel):
    user_id: str
    password: str
    name: Optional[str] = ""

class ProfilePayload(BaseModel):
    user_id: str
    form_data: dict

class GenSubjectsPayload(BaseModel):
    user_goal: dict
    tags: list

class GenSubjectWeightsPayload(BaseModel):
    subjects: list
    user_goal: dict

class GenUnitsPayload(BaseModel):
    subjects: list
    user_goal: dict

class GenUnitWeightsPayload(BaseModel):
    subjects_with_units: list
    user_goal: dict

class GenerateScheduleFinalPayload(BaseModel):
    form_data: dict
    ai_draft: dict
    session_id: str

class ChatPayload(BaseModel):
    session_id: str
    message: str

class FinalizePayload(BaseModel):
    session_id: str

class UpdateWeightsPayload(BaseModel):
    session_id: str
    new_spreadsheet_data: dict

class ReschedulePayload(BaseModel):
    session_id: str
    schedule_id: str

class EvaluatePayload(BaseModel):
    session_id: str
    subject: str
    explanation: str

class RescheduleAutoPayload(BaseModel):
    session_id: str

class SaveAttendancePayload(BaseModel):
    session_id: str
    date: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    is_managed: bool = False
    consult_checked: bool = False
    consult_note: str = ''
    scheduled_in_time: Optional[str] = None
    scheduled_out_time: Optional[str] = None

class SaveMessagePayload(BaseModel):
    session_id: str
    sender_role: str
    content: str

class ConsultTagPayload(BaseModel):
    session_id: str
    date: str

class NfcTagPayload(BaseModel):
    session_id: str
    date: str

class TaskTogglePayload(BaseModel):
    week_number: int
    task_index: int
    completed: bool

# ----------------- Helper Functions -----------------

def is_late_by_10_mins(now_time_str: str, scheduled_in_str: str | None) -> bool:
    if not scheduled_in_str or not now_time_str:
        return False
    try:
        now_h, now_m = map(int, now_time_str.split(':'))
        sch_h, sch_m = map(int, scheduled_in_str.split(':'))
        return (now_h * 60 + now_m) > (sch_h * 60 + sch_m + 10)
    except:
        return False

def is_past_exit_time(now_time_str: str, scheduled_out_str: str | None) -> bool:
    if not scheduled_out_str or not now_time_str:
        return False
    try:
        now_h, now_m = map(int, now_time_str.split(':'))
        sch_h, sch_m = map(int, scheduled_out_str.split(':'))
        return (now_h * 60 + now_m) > (sch_h * 60 + sch_m)
    except:
        return False

async def _background_rag_scheduler(goal_id: str, goal_details: dict, tags: list):
    """백그라운드에서 비동기로 실행되는 RAG 기반 일정 생성 로직"""
    print(f"[RAG] Generating curriculum for Goal: {goal_id} with tags: {tags}")
    
    # AI 엔진 호출 (비동기)
    generated_schedule = await context.ai_tutor.generate_rag_curriculum(goal_details, tags)
    
    if "error" in generated_schedule:
        print(f"[RAG ERR] {generated_schedule['error']}")
        return
        
    # 학부모 공유용 관찰자 코드 생성
    import random, string
    observer_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    # 생성된 일정을 다시 지식정보창고에 저장
    schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
    
    # 원본 목표 ID 및 관찰자 코드 참조
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


# ----------------- FastAPI Endpoints -----------------

@app.post("/knowledge/goal")
async def create_goal_and_schedule(payload: GoalPayload, background_tasks: BackgroundTasks):
    """
    1. 수험생의 새로운 목표를 지식정보창고에 저장
    2. 비동기로 과거 지식 검색(RAG) 후 AI 스케줄 생성하여 저장
    """
    goal_id = f"kb_goal_{uuid.uuid4().hex[:8]}"
    success = context.knowledge_repo.insert_knowledge(
        doc_id=goal_id,
        domain_type="GoalSetting",
        tags=payload.tags,
        payload=payload.goal_details
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save goal to Knowledge Base")
        
    # 비동기 RAG 파이프라인 트리거
    background_tasks.add_task(_background_rag_scheduler, goal_id, payload.goal_details, payload.tags)
    
    return {"status": "success", "message": "목표가 지식창고에 저장되었습니다. AI가 과거 지식을 검색하여 최적의 일정을 생성 중입니다.", "goal_id": goal_id}

@app.get("/knowledge/search")
async def search_knowledge(tags: str):
    """주어진 태그 리스트(콤마 분리)로 지식정보창고 검색"""
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    results = context.knowledge_repo.search_knowledge_by_tags(tag_list, limit=10)
    return {"status": "success", "data": results}

@app.post("/knowledge/signup")
async def signup(payload: AuthPayload):
    print(f"[DEBUG] Attempting signup for user_id: {payload.user_id}")
    success = context.user_repo.register_user(payload.user_id, payload.password, payload.name or "")
    print(f"[DEBUG] Signup result for {payload.user_id}: {success}")
    if success:
        return {"status": "success", "success": True, "message": "User registered successfully"}
    else:
        return {"status": "error", "success": False, "message": "User ID already exists or failed to register"}

@app.post("/knowledge/login")
async def login(payload: AuthPayload):
    print(f"[DEBUG] Attempting login for user_id: {payload.user_id}")
    user_info = context.user_repo.get_user_info(payload.user_id)
    print(f"[DEBUG] User info retrieved: {user_info is not None}")
    if user_info and user_info["password"] == payload.password:
        print(f"[DEBUG] Login successful for {payload.user_id}")
        return {
            "status": "success",
            "success": True,
            "message": "Login successful",
            "name": user_info["name"]
        }
    else:
        print(f"[DEBUG] Login failed for {payload.user_id} - invalid credentials")
        return {"status": "error", "success": False, "message": "Invalid user ID or password"}

class UpdateUserPayload(BaseModel):
    user_id: str
    name: str
    password: str

@app.get("/knowledge/user/{user_id}")
async def get_user_info(user_id: str):
    user_info = context.user_repo.get_user_info(user_id)
    if user_info:
        return {"status": "success", "data": user_info}
    else:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

@app.post("/knowledge/user/update")
async def update_user(payload: UpdateUserPayload):
    success = context.user_repo.update_user_info(payload.user_id, payload.name, payload.password)
    if success:
        return {"status": "success", "message": "개인 정보가 수정되었습니다."}
    else:
        return {"status": "error", "message": "정보 수정에 실패했습니다."}

@app.get("/knowledge/profile/{user_id}")
async def get_profile(user_id: str):
    profile_data = context.user_repo.get_user_profile(user_id)
    return {"status": "success", "data": profile_data}

@app.post("/knowledge/profile")
async def save_profile(payload: ProfilePayload):
    success = context.user_repo.save_user_profile(payload.user_id, payload.form_data)
    if success:
        return {"status": "success", "message": "Profile saved successfully"}
    return {"status": "error", "message": "Failed to save profile"}

@app.post("/knowledge/form_onboard")
async def onboard_via_form(payload: FormOnboardPayload):
    """질문지(Form) 데이터를 받아 즉시 세션을 만들고 초안을 생성함"""
    user_id = f"user_{uuid.uuid4().hex[:6]}"
    tags = ["대화형온보딩", payload.form_data.get("goal", "기본목표")]
    
    # 1. AI를 통한 과목/단원 및 배분율(%) 추출 (비동기)
    ai_draft = await context.ai_tutor.generate_rag_curriculum(payload.form_data, tags)
    
    # 2. 알고리즘을 이용한 정밀 캘린더 스케줄링
    draft = context.scheduler.calculate_schedule(payload.form_data, ai_draft)
    
    ai_greeting = "작성해주신 질문지를 바탕으로 100% 맞춤형 초안 진도표를 생성했습니다! 🎉\n\n좌측의 스케줄을 확인해 보시고, 수정하고 싶은 부분을 우측 채팅창에 편하게 말씀해 주세요. (예: 일요일은 쉬게 해줘, 방정식 단원에 시간 더 배정해줘)"
    
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

@app.post("/knowledge/generate_subjects")
async def api_generate_subjects(payload: GenSubjectsPayload):
    res = await context.ai_tutor.generate_subjects(payload.user_goal, payload.tags)
    return {"status": "success", "data": res}

@app.post("/knowledge/generate_subject_weights")
async def api_generate_subject_weights(payload: GenSubjectWeightsPayload):
    res = await context.ai_tutor.generate_subject_weights(payload.subjects, payload.user_goal)
    return {"status": "success", "data": res}

@app.post("/knowledge/generate_units")
async def api_generate_units(payload: GenUnitsPayload):
    res = await context.ai_tutor.generate_units(payload.subjects, payload.user_goal)
    return {"status": "success", "data": res}

@app.post("/knowledge/generate_unit_weights")
async def api_generate_unit_weights(payload: GenUnitWeightsPayload):
    res = await context.ai_tutor.generate_unit_weights(payload.subjects_with_units, payload.user_goal)
    return {"status": "success", "data": res}

@app.post("/knowledge/generate_schedule_final")
async def api_generate_schedule_final(payload: GenerateScheduleFinalPayload):
    draft = context.scheduler.calculate_schedule(payload.form_data, payload.ai_draft)
    
    chat_history = [
        {"role": "user", "content": "[시스템: 단계별 스케줄 생성이 완료되었습니다.]"},
        {"role": "assistant", "content": "스케줄 생성이 완료되었습니다! 대시보드에서 일정을 확인하세요."}
    ]
    
    user_id = payload.form_data.get("user_id", f"user_{uuid.uuid4().hex[:6]}")
    
    # 1. Goal 저장
    goal_id = f"kb_goal_{uuid.uuid4().hex[:8]}"
    tags = ["대화형온보딩", payload.form_data.get("목표", "기본목표")]
    context.knowledge_repo.insert_knowledge(doc_id=goal_id, domain_type="GoalSetting", tags=tags, payload=payload.form_data)
    
    # 2. Schedule 저장 및 Observer Code 발급
    import random, string
    observer_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
    
    draft["ref_goal_id"] = goal_id 
    draft["observer_code"] = observer_code
    draft["session_id"] = payload.session_id
    new_tags = tags + ["최종스케줄", f"obs_{observer_code}", f"sess_{payload.session_id}"]
    
    # 만약 기존에 일정이 있었다면 superseded 처리 (리스케줄링 대비)
    search_tag = f"sess_{payload.session_id}"
    old_results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=5)
    for old_doc in old_results:
        if old_doc["payload"].get("status") != "superseded":
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
        collected_data=payload.form_data,
        draft_schedule=draft,
        is_finalized=True
    )
    
    return {"status": "success", "draft_schedule": draft}

@app.post("/knowledge/chat")
async def process_chat(payload: ChatPayload, background_tasks: BackgroundTasks):
    """대화형 온보딩 마법사 채팅 엔드포인트"""
    session = context.chat_repo.get_chat_session(payload.session_id)
    
    if not session:
        # 새 세션 생성
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
    
    val_collected = session.get("collected_data")
    collected_data = dict(val_collected) if isinstance(val_collected, dict) else {}
    
    val_draft = session.get("draft_schedule")
    draft_schedule = dict(val_draft) if isinstance(val_draft, dict) else {}

    if session.get("is_finalized"):
        return {"status": "success", "ai_response": "이미 확정된 일정입니다.", "current_stage": current_stage}

    user_info = context.user_repo.get_user_info(payload.session_id)
    user_name = user_info["name"] if (user_info and "name" in user_info) else ""

    # AI 상태 머신 호출 (비동기)
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

    # 채팅 기록 업데이트
    new_history = chat_history + [
        {"role": "user", "content": payload.message},
        {"role": "assistant", "content": ai_result["ai_response"]}
    ]
    
    new_stage = ai_result.get("new_stage", current_stage)
    new_collected_data = ai_result.get("new_collected_data", session.get("collected_data", {}))
    
    # Mode 2 수정일 경우
    if current_stage == 2 and "new_spreadsheet_data" in ai_result:
        # AI가 변경한 스프레드시트 배분율을 기반으로 새로운 스케줄을 다시 계산함!
        updated_spreadsheet = ai_result["new_spreadsheet_data"]
        new_draft_schedule = context.scheduler.calculate_schedule(new_collected_data, updated_spreadsheet)
    else:
        new_draft_schedule = ai_result.get("new_draft_schedule", session.get("draft_schedule"))

    # Mode 1(목표 설정)에서 Mode 2(초안 편집)로 막 넘어간 경우: 즉시 초안 생성 (비동기)
    if current_stage == 1 and new_stage == 2:
        tags = ["대화형온보딩", new_collected_data.get("목표", "기본목표")]
        ai_draft = await context.ai_tutor.generate_rag_curriculum(new_collected_data, tags)
        new_draft_schedule = context.scheduler.calculate_schedule(new_collected_data, ai_draft)
        ai_result["ai_response"] += "\n\n🎉 목표가 파악되었습니다! 화면 좌측에 AI가 생성한 '초안 일정'을 띄워드렸어요. 수정하고 싶은 부분이 있다면 저에게 편하게 말씀해 주세요. (예: 주말 일정은 삭제해 줘)"

    # 세션 DB 저장
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

@app.post("/knowledge/finalize")
async def finalize_schedule(payload: FinalizePayload):
    """수험생이 수정을 마치고 [이 계획으로 확정하기] 버튼을 누름"""
    session = context.chat_repo.get_chat_session(payload.session_id)
    if not session or session.get("is_finalized"):
        raise HTTPException(status_code=400, detail="유효하지 않은 세션이거나 이미 확정되었습니다.")
        
    collected_data = session["collected_data"]
    draft_schedule = session["draft_schedule"]
    
    # 1. Goal 저장
    goal_id = f"kb_goal_{uuid.uuid4().hex[:8]}"
    tags = ["대화형온보딩", collected_data.get("목표", "기본목표")]
    context.knowledge_repo.insert_knowledge(doc_id=goal_id, domain_type="GoalSetting", tags=tags, payload=collected_data)
    
    # 2. Schedule 저장 및 Observer Code 발급
    import random, string
    observer_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
    
    draft_schedule["ref_goal_id"] = goal_id 
    draft_schedule["observer_code"] = observer_code
    draft_schedule["session_id"] = payload.session_id
    new_tags = tags + ["최종스케줄", f"obs_{observer_code}", f"sess_{payload.session_id}"]
    
    # 만약 Mode 3(리스케줄링) 확정이었다면, 기존 활성 일정을 찾아 superseded 처리함
    search_tag = f"sess_{payload.session_id}"
    old_results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=5)
    for old_doc in old_results:
        if old_doc["payload"].get("status") != "superseded":
            old_doc["payload"]["status"] = "superseded"
            context.knowledge_repo.insert_knowledge(doc_id=old_doc["doc_id"], domain_type=old_doc["domain_type"], tags=old_doc["tags"], payload=old_doc["payload"])
            draft_schedule["ref_previous_schedule_id"] = old_doc["doc_id"]
            break

    context.knowledge_repo.insert_knowledge(doc_id=schedule_id, domain_type="StudySchedule", tags=new_tags, payload=draft_schedule)
    
    # 세션 확정 처리
    context.chat_repo.save_chat_session(session["session_id"], session["user_id"], session["current_stage"], session["chat_history"], collected_data, draft_schedule, True)
    
    return {"status": "success", "message": "성공적으로 확정되었습니다.", "observer_code": observer_code}

@app.post("/knowledge/schedule/update_weights")
async def update_schedule_weights(payload: UpdateWeightsPayload):
    """사용자가 직접 UI에서 과목/단원 비중을 조절했을 때 스케줄을 재계산"""
    session = context.chat_repo.get_chat_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    collected_data = session.get("collected_data", {})
    
    # 새로운 스프레드시트 기반으로 스케줄 재계산
    new_draft_schedule = context.scheduler.calculate_schedule(collected_data, payload.new_spreadsheet_data)
    
    # 세션에 저장
    context.chat_repo.save_chat_session(
        session_id=session["session_id"],
        user_id=session["user_id"],
        current_stage=session["current_stage"],
        chat_history=session["chat_history"],
        collected_data=collected_data,
        draft_schedule=new_draft_schedule,
        is_finalized=session["is_finalized"]
    )
    
    return {
        "status": "success",
        "message": "진도표가 성공적으로 재조정되었습니다.",
        "draft_schedule": new_draft_schedule
    }

@app.post("/knowledge/evaluate")
async def evaluate_understanding(payload: EvaluatePayload):
    """학생의 구술 설명을 AI가 평가하여 점수(0~100)와 피드백을 반환"""
    user_info = context.user_repo.get_user_info(payload.session_id)
    user_name = user_info["name"] if (user_info and "name" in user_info) else "학생"

    prompt = f"""
수험생 이름: {user_name}
{user_name} 수험생이 방금 공부한 [{payload.subject}] 목표에 대해 자기만의 언어로 달성 과정을 설명했습니다.
{user_name} 수험생의 설명: "{payload.explanation}"

{user_name} 수험생이 단순히 지식을 나열하는 것이 아니라, 자기만의 언어로 이해했는지, 그리고 학습 과정에서 어려웠던 점을 극복하려는 '메타인지적 노력'이 보이는지 중점적으로 평가해 주세요.
이 설명을 평가하여 0에서 100 사이의 점수와 짧고 격려하는 피드백(1~2문장)을 주세요. 피드백 작성 시 반드시 {user_name} 님의 이름을 넣어서 다정하고 친근하게 격려해 주세요. (예: "{user_name} 님, 오늘 ...")
출력은 반드시 아래 JSON 구조여야 합니다.
{{
  "score": 85,
  "feedback": "..."
}}
"""
    try:
        # LLM 호출 (비동기)
        result = await context.ai_tutor.call_llm(prompt=prompt, temperature=0.5)
        return result
    except Exception as e:
        print(f"[EVAL ERR] {e}")
        return {"score": 0, "feedback": "평가 시스템 오류"}

@app.post("/knowledge/schedule/reschedule_auto")
async def reschedule_schedule_auto(payload: RescheduleAutoPayload):
    """진도가 밀렸을 때, 완료된 일정을 보존하고 미완료 일정만 오늘부터 마감일까지 알고리즘 기반 재조정"""
    # 1. 최신 활성 스케줄 찾기
    search_tag = f"sess_{payload.session_id}"
    results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=10)
    active_schedule = None
    for r in results:
        if r["payload"].get("status") != "superseded":
            active_schedule = r
            break
            
    if not active_schedule:
        raise HTTPException(status_code=404, detail="Active schedule not found")
        
    session = context.chat_repo.get_chat_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    form_data = session.get("collected_data", {})
    
    # 2. Scheduler 클래스를 이용하여 재조정된 일정 생성
    active_schedule_payload = {**active_schedule["payload"], "doc_id": active_schedule["doc_id"]}
    new_payload = context.scheduler.reschedule_auto(form_data, active_schedule_payload)
    
    # 3. 기존 활성 스케줄을 superseded 처리
    active_schedule["payload"]["status"] = "superseded"
    context.knowledge_repo.insert_knowledge(
        doc_id=active_schedule["doc_id"],
        domain_type=active_schedule["domain_type"],
        tags=active_schedule["tags"],
        payload=active_schedule["payload"]
    )
    
    # 4. 신규 스케줄 저장
    new_schedule_id = f"kb_plan_{uuid.uuid4().hex[:8]}"
    context.knowledge_repo.insert_knowledge(
        doc_id=new_schedule_id,
        domain_type="StudySchedule",
        tags=active_schedule["tags"],
        payload=new_payload
    )
    
    # 5. 세션 상태 업데이트
    session["draft_schedule"] = new_payload
    context.chat_repo.save_chat_session(
        session_id=session["session_id"],
        user_id=session["user_id"],
        current_stage=session["current_stage"],
        chat_history=session["chat_history"],
        collected_data=session["collected_data"],
        draft_schedule=new_payload,
        is_finalized=True
    )
    
    return {"status": "success", "message": "미완료 일정이 오늘부터 마감일까지 성공적으로 재조정되었습니다."}

@app.post("/knowledge/chat/reschedule")
async def start_reschedule(payload: ReschedulePayload):
    """진도가 밀렸을 때, 기존 일정을 바탕으로 Mode 3 (리스케줄링) 대화 시작"""
    doc = context.knowledge_repo.get_knowledge(payload.schedule_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    session = context.chat_repo.get_chat_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # 상태를 Mode 3로 변경하고, is_finalized를 False로 풀어 대화 모드로 재진입
    session["current_stage"] = 3
    session["draft_schedule"] = doc["payload"]
    session["is_finalized"] = False
    
    session["chat_history"].append({
        "role": "assistant",
        "content": "진도가 밀려서 속상하시죠? 괜찮습니다! 현재까지의 달성률을 바탕으로 남은 일정을 어떻게 조정하면 좋을지 말씀해 주세요."
    })
    
    context.chat_repo.save_chat_session(session["session_id"], session["user_id"], 3, session["chat_history"], session["collected_data"], doc["payload"], False)
    
    return {"status": "success", "message": "리스케줄링 모드로 전환되었습니다."}

@app.get("/knowledge/chat/{session_id}")
async def get_chat(session_id: str):
    """특정 세션의 대화 내역 불러오기"""
    session = context.chat_repo.get_chat_session(session_id)
    if not session:
        return {"status": "success", "data": None}
    return {"status": "success", "data": session}

@app.get("/knowledge/observe/{observer_code}")
async def get_observed_schedule(observer_code: str):
    """학부모 참관용: 발급된 코드로 읽기 전용 스케줄 불러오기"""
    search_tag = f"obs_{observer_code}"
    results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=1)
    
    if not results:
        raise HTTPException(status_code=404, detail="유효하지 않은 참관 코드입니다.")
        
    data = results[0]
    data["is_read_only"] = True 
    return {"status": "success", "data": data}

@app.get("/knowledge/student/{session_id}")
async def get_student_schedule(session_id: str):
    """학생 대시보드용: 세션 ID로 최신 스케줄 불러오기"""
    search_tag = f"sess_{session_id}"
    results = context.knowledge_repo.search_knowledge_by_tags([search_tag], limit=10)
    
    # 여러 버전이 있을 수 있으므로 최신(제일 먼저 오는) superseded 안된 버전 찾기
    active_schedule = None
    for r in results:
        if r["payload"].get("status") != "superseded":
            active_schedule = r
            break
            
    if not active_schedule:
        return {"status": "success", "data": None}
        
    return {"status": "success", "data": active_schedule}

@app.patch("/knowledge/schedule/{schedule_id}/task")
async def toggle_task_completion(schedule_id: str, payload: TaskTogglePayload):
    """특정 일정의 일일 태스크 완료 상태를 토글"""
    doc = context.knowledge_repo.get_knowledge(schedule_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    sched_payload = doc["payload"]
    
    # 해당 주차 찾기
    for week in sched_payload.get("curriculum", []):
        if week["week_number"] == payload.week_number:
            daily_tasks = week.get("daily_tasks", [])
            if payload.task_index < len(daily_tasks):
                daily_tasks[payload.task_index]["completed"] = payload.completed
            break
                
    # 변경된 페이로드 다시 저장 (tags 등은 기존 것 유지)
    context.knowledge_repo.insert_knowledge(
        doc_id=schedule_id, 
        domain_type=doc["domain_type"], 
        tags=doc["tags"], 
        payload=sched_payload
    )
    
    return {"status": "success", "message": "진도 상태가 업데이트되었습니다."}

@app.get("/knowledge/attendance/{session_id}")
async def api_get_attendance(session_id: str):
    history = context.attendance_repo.get_attendance_history(session_id)
    return {"status": "success", "data": history}

@app.post("/knowledge/attendance")
async def api_save_attendance(payload: SaveAttendancePayload):
    # 관리자가 수동으로 기입/수정 시 상태머신용 태깅 횟수 및 상담 개시 시간을 지능적으로 자동 보정(Self-Healing)합니다.
    inferred_tag_count = 0
    inferred_consult_start = None
    
    if payload.check_in_time:
        inferred_tag_count = 1
        if payload.check_out_time:
            if payload.consult_checked:
                inferred_tag_count = 3
                inferred_consult_start = payload.check_in_time # 기본 등원 시각으로 채워 경고 해제
            else:
                inferred_tag_count = 2

    # 기존 DB 내 기록 확인하여 이미 등록된 상담 시작 시각이 있다면 그대로 유지
    conn = context.db_manager.get_db_conn()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("SELECT consult_start_time FROM attendance WHERE session_id = ? AND date = ?", (payload.session_id, payload.date))
            row = cur.fetchone()
            if row and row[0]:
                inferred_consult_start = row[0]
        except:
            pass
        finally:
            conn.close()

    res = context.attendance_repo.save_attendance(
        session_id=payload.session_id,
        date=payload.date,
        check_in_time=payload.check_in_time,
        check_out_time=payload.check_out_time,
        is_managed=payload.is_managed,
        consult_checked=payload.consult_checked,
        consult_note=payload.consult_note,
        scheduled_in_time=payload.scheduled_in_time,
        scheduled_out_time=payload.scheduled_out_time,
        consult_start_time=inferred_consult_start,
        tag_count=inferred_tag_count
    )
    if res:
        return {"status": "success", "message": "출석 정보가 업데이트되었습니다."}
    else:
        raise HTTPException(status_code=500, detail="출석 정보 저장 실패")

@app.get("/knowledge/admin/students")
async def api_admin_get_students():
    profiles = context.user_repo.get_all_user_profiles()
    return {"status": "success", "data": profiles}

@app.get("/knowledge/messages/{session_id}")
async def api_get_messages(session_id: str):
    msgs = context.message_repo.get_study_messages(session_id)
    return {"status": "success", "data": msgs}

@app.post("/knowledge/messages")
async def api_save_message(payload: SaveMessagePayload):
    res = context.message_repo.save_study_message(payload.session_id, payload.sender_role, payload.content)
    if res:
        return {"status": "success", "message": "메시지가 저장되었습니다."}
    else:
        raise HTTPException(status_code=500, detail="메시지 저장 실패")

@app.post("/knowledge/attendance/consult_tag")
async def api_consult_tag(payload: ConsultTagPayload):
    import time
    
    # 1. 오늘 해당 이용자의 상담 상태를 '완료(consult_checked = 1)'로 출석 저장
    res = context.attendance_repo.save_attendance(
        session_id=payload.session_id,
        date=payload.date,
        is_managed=True,
        consult_checked=True
    )
    
    # 2. 전역 이벤트 발행 (DB 기반 - 프로세스 세이프)
    context.save_latest_consult_tag(payload.session_id, int(time.time()))
    
    if res:
        return {"status": "success", "message": "상담용 NFC 태깅 기록이 처리되었습니다."}
    else:
        raise HTTPException(status_code=500, detail="상담 NFC 태깅 실패")

@app.get("/knowledge/admin/latest_consult_tag")
async def api_get_latest_consult_tag():
    # DB 기반 조회 (프로세스 세이프)
    latest_tag = context.get_latest_consult_tag()
    return {"status": "success", "data": latest_tag}

@app.post("/knowledge/attendance/nfc_tag")
async def api_nfc_tag(payload: NfcTagPayload):
    from datetime import datetime
    import time
    
    conn = context.db_manager.get_db_conn()
    if not conn:
        raise HTTPException(status_code=500, detail="DB 연결 실패")
    
    now_time_str = datetime.now().strftime("%H:%M")
    
    try:
        # 1. 학생 프로필 및 관리방식, 등하원예약시간 조회
        cur = conn.cursor()
        cur.execute("SELECT form_data FROM study_knowledge_bundles WHERE id = ?", (f"profile_{payload.session_id}",))
        row = cur.fetchone()
        is_managed = False
        scheduled_in = None
        scheduled_out = None
        
        if row:
            import json
            fd = json.loads(row[0]) if row[0] else {}
            is_managed = (fd.get("관리방식") == "관리형")
            
            days = ['일', '월', '화', '수', '목', '금', '토']
            day_name = days[datetime.strptime(payload.date, "%Y-%m-%d").weekday()]
            sched = fd.get("등하원예약시간", {}).get(day_name, {})
            scheduled_in = sched.get("in")
            scheduled_out = sched.get("out")

        # 2. 오늘의 출결 정보 조회
        cur.execute("SELECT check_in_time, check_out_time, consult_start_time, tag_count, tag1_time, tag2_time, tag3_time FROM attendance WHERE session_id = ? AND date = ?", (payload.session_id, payload.date))
        att = cur.fetchone()
        
        # 1단계: 첫 번째 스캔 (tag_count == 0 또는 기록이 없는 경우)
        if not att or not att[0]:
            # 10분 이상 지각이면 결석 처리 (상담, 퇴실 없음)
            is_absent = is_late_by_10_mins(now_time_str, scheduled_in)
            
            context.attendance_repo.save_attendance(
                session_id=payload.session_id,
                date=payload.date,
                check_in_time=now_time_str,
                is_managed=is_managed,
                scheduled_in_time=scheduled_in,
                scheduled_out_time=scheduled_out,
                tag_count=1,
                tag1_time=now_time_str,
                consult_note="[결석] 10분 이상 지각으로 자동 결석 처리" if is_absent else ""
            )
            if is_absent:
                return {"status": "success", "tag_type": "absent", "time": now_time_str, "message": f"[{payload.session_id}] 10분 초과 지각으로 결석 처리되었습니다. (상담/퇴장 등록 불가)"}
            else:
                return {"status": "success", "tag_type": "check_in", "time": now_time_str, "message": f"[{payload.session_id}] 등원 처리 완료 ({now_time_str})"}
        
        check_in, check_out, consult_start, tag_cnt, tag1, tag2, tag3 = att
        tag_cnt = tag_cnt or 1
        
        # 만약 첫 번째 스캔 시 지각으로 결석 처리된 학생이라면 추가 태깅 무시
        if is_late_by_10_mins(tag1, scheduled_in):
            return {"status": "success", "tag_type": "absent_blocked", "message": "결석 처리된 학생이므로 추가 태깅을 진행할 수 없습니다."}
            
        # 이미 3번 스캔 혹은 하원 완료된 경우 무시
        if check_out:
            return {"status": "success", "tag_type": "already_completed", "message": "오늘의 등하원 및 상담 일정이 모두 완료되었습니다."}
        
        # 2단계: 두 번째 스캔 (tag_count == 1인 경우)
        if tag_cnt == 1:
            # 퇴장 시간이 지났는지 체크
            if is_past_exit_time(now_time_str, scheduled_out):
                # 2번만 스캔하고 하원하는 경우 (상담 없음)
                context.attendance_repo.save_attendance(
                    session_id=payload.session_id,
                    date=payload.date,
                    check_out_time=now_time_str,
                    is_managed=is_managed,
                    consult_checked=False, # 상담 없음
                    tag_count=2,
                    tag2_time=now_time_str,
                    consult_note="[상담 미이행] 상담 없이 조기 하원"
                )
                return {"status": "success", "tag_type": "check_out_no_consult", "time": now_time_str, "message": f"[{payload.session_id}] 퇴장 시간 초과로 상담 없이 퇴장 처리 완료 ({now_time_str})"}
            else:
                # 퇴장 시간 전이므로 2번째 스캔은 '상담 시작 시간'으로 기록
                context.attendance_repo.save_attendance(
                    session_id=payload.session_id,
                    date=payload.date,
                    is_managed=is_managed,
                    consult_checked=True, # 상담 진행
                    consult_start_time=now_time_str,
                    tag_count=2,
                    tag2_time=now_time_str
                )
                # 관리자 대시보드 자동 포커싱을 위해 consult tag 시간 갱신 (DB 기반 - 프로세스 세이프)
                context.save_latest_consult_tag(payload.session_id, int(time.time()))
                
                return {"status": "success", "tag_type": "consult_start", "time": now_time_str, "message": f"[{payload.session_id}] 퇴실 상담 시작 등록 및 대시보드 연동 완료 ({now_time_str})"}
        
        # 3단계: 세 번째 스캔 (tag_count == 2인 경우)
        if tag_cnt == 2:
            context.attendance_repo.save_attendance(
                session_id=payload.session_id,
                date=payload.date,
                check_out_time=now_time_str,
                is_managed=is_managed,
                tag_count=3,
                tag3_time=now_time_str
            )
            return {"status": "success", "tag_type": "check_out", "time": now_time_str, "message": f"[{payload.session_id}] 최종 하원(퇴장) 처리 완료 ({now_time_str})"}
            
        return {"status": "success", "tag_type": "already_completed", "message": "오늘의 등하원 및 상담 일정이 모두 완료되었습니다."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NFC 통합 태깅 중 오류: {e}")
    finally:
        conn.close()

# ----------------- Static File Hosting & SPA Fallback -----------------
DIST_DIR = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("knowledge/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
