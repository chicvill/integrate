"""
apps/selfstudy/backend/models.py
MQstudy / SelfStudy 플랫폼 전용 ORM 모델 (shared.core.base_database.Base 상속).
오픈소스 chicvill/selfstudy 원작 DB 스키마 100% 호환.
"""
import uuid
import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, Text, Date, ForeignKey
from shared.core.base_database import Base, TimestampMixin, AppIdMixin


class StudyUser(Base, TimestampMixin):
    """사용자 / 관리자 / 학생 계정 모델"""
    __tablename__ = "study_users"

    user_id = Column(String(100), primary_key=True)  # 전화번호 또는 아이디
    password = Column(String(200), nullable=False)
    name = Column(String(100), default="")
    role = Column(String(50), default="GENERAL")  # GENERAL (자율형) | MANAGED (관리형) | ADMIN (관리자)
    is_locked = Column(Boolean, default=False)
    last_visit_at = Column(DateTime(timezone=True), default=datetime.datetime.now)


class UserProfile(Base, TimestampMixin):
    """유저별 최신 프로필/온보딩 폼 저장 모델"""
    __tablename__ = "user_profiles"

    user_id = Column(String(100), primary_key=True)
    form_data = Column(JSON, default=dict)


class StudyChatSession(Base, TimestampMixin):
    """대화형 온보딩 및 AI 캘린더 스케줄 세션 모델"""
    __tablename__ = "study_chat_sessions"

    session_id = Column(String(100), primary_key=True)  # 참관 코드 / 세션 ID
    user_id = Column(String(100), nullable=True, index=True)
    current_stage = Column(Integer, default=1)
    chat_history = Column(JSON, default=list)
    collected_data = Column(JSON, default=dict)
    draft_schedule = Column(JSON, nullable=True)  # AI 계산 일별/단원별 캘린더
    is_finalized = Column(Boolean, default=False)


class StudyAttendance(Base, TimestampMixin):
    """출결 및 대면 상담 일지 모델"""
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(100), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    check_in_time = Column(String(20), nullable=True)
    check_out_time = Column(String(20), nullable=True)
    is_managed = Column(Boolean, default=False)
    consult_checked = Column(Boolean, default=False)
    consult_note = Column(Text, default="")
    scheduled_in_time = Column(String(20), nullable=True)
    scheduled_out_time = Column(String(20), nullable=True)
    consult_start_time = Column(String(20), nullable=True)
    tag_count = Column(Integer, default=0)
    tag1_time = Column(String(20), nullable=True)
    tag2_time = Column(String(20), nullable=True)
    tag3_time = Column(String(20), nullable=True)


class StudyMessage(Base, TimestampMixin):
    """학생-학부모-관리자 3자 메시지 소통 모델"""
    __tablename__ = "study_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(100), nullable=False, index=True)
    sender_role = Column(String(50), nullable=False)  # student | parent | admin
    content = Column(Text, nullable=False)


class StudyKnowledgeBundle(Base, TimestampMixin):
    """지식정보창고 (RAG 지식 인덱스) 모델"""
    __tablename__ = "study_knowledge_bundles"

    id = Column(String(100), primary_key=True)
    domain_type = Column(String(100), nullable=False)
    tags = Column(JSON, default=list)
    payload = Column(JSON, default=dict)


class CafeSetting(Base, TimestampMixin):
    """카페 환경설정 (IP / 고정형 QR) 모델"""
    __tablename__ = "cafe_settings"

    setting_key = Column(String(100), primary_key=True)
    setting_value = Column(Text, nullable=True)


class StudyPlan(Base, TimestampMixin):
    """학습 계획 하위 호환용 모델"""
    __tablename__ = "selfstudy_plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(100), default="demo-student", index=True)
    teacher_id = Column(String(100), nullable=True)
    tenant_id = Column(String(100), default="selfstudy-main", index=True)
    title = Column(String(200), nullable=False)
    subject = Column(String(100), nullable=False)
    category = Column(String(50), default="일반")
    target_score = Column(String(100), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    daily_goal_minutes = Column(Integer, default=60)
    weekly_schedule = Column(JSON, nullable=True)
    status = Column(String(50), default="active")


class StudyProgress(Base, TimestampMixin):
    """학습 진도 하위 호환용 모델"""
    __tablename__ = "selfstudy_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(100), default="demo-student", index=True)
    plan_id = Column(String(100), nullable=True)
    study_date = Column(Date, nullable=False)
    studied_minutes = Column(Integer, default=0)
    completed_tasks = Column(JSON, nullable=True)
    self_score = Column(Integer, default=5)
    streak_days = Column(Integer, default=1)
    note = Column(Text, nullable=True)


class AIFeedback(Base, TimestampMixin):
    """AI 학습 피드백 하위 호환용 모델"""
    __tablename__ = "selfstudy_ai_feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(100), default="demo-student", index=True)
    plan_id = Column(String(100), default="general")
    feedback_type = Column(String(50), default="weekly")
    question = Column(Text, nullable=True)
    answer = Column(Text, nullable=True)
    feedback_content = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=True)
    generated_by = Column(String(50), default="gemini-2.5-flash")
