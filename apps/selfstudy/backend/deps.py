import asyncio
from datetime import datetime
from db import DatabaseManager, UserRepository, KnowledgeRepository, ChatSessionRepository, AttendanceRepository, MessageRepository, CafeSettingsRepository
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
        self.cafe_settings_repo = CafeSettingsRepository(self.db_manager)
        
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

context = AppContext()

async def keepalive_loop():
    print("[INFO] Render & Supabase Keep-Alive background task started (Interval: 5 minutes)...")
    while True:
        try:
            success = context.db_manager.ping_keepalive(1)
            if success:
                print(f"[KEEPALIVE] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Saved 1 to Supabase/DB (keepalive_ping).")
            
            # 주기적으로 권한 정책(7일 미방문 차단, 30일 삭제) 검사 및 적용
            context.user_repo.enforce_access_policies()

        except Exception as e:
            print(f"[KEEPALIVE ERR] {e}")
        await asyncio.sleep(300)
