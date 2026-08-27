"""apps/selfstudy/backend/models.py - 자기주도학습 전용 ORM 모델"""
import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Text, Date
from shared.core.base_database import Base, TimestampMixin


class StudyPlan(Base, TimestampMixin):
    """학습 계획 모델"""
    __tablename__ = "selfstudy_plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    teacher_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    tenant_id = Column(String(100), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    subject = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    daily_goal_minutes = Column(Integer, default=60)
    weekly_schedule = Column(JSON, nullable=True)  # {"mon": true, "tue": false, ...}
    status = Column(String(50), default="active")  # active | paused | completed


class StudyProgress(Base, TimestampMixin):
    """학습 진도 기록 모델"""
    __tablename__ = "selfstudy_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    plan_id = Column(String(36), ForeignKey("selfstudy_plans.id"), nullable=False)
    study_date = Column(Date, nullable=False)
    studied_minutes = Column(Integer, default=0)
    completed_tasks = Column(JSON, nullable=True)  # ["교과서 p.10-15", "수학 문제 10개"]
    self_score = Column(Integer, nullable=True)  # 자기 평가 (1-5)
    note = Column(Text, nullable=True)


class AIFeedback(Base, TimestampMixin):
    """AI 학습 피드백 모델"""
    __tablename__ = "selfstudy_ai_feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    plan_id = Column(String(36), nullable=False)
    feedback_type = Column(String(50), default="weekly")  # daily | weekly | milestone
    feedback_content = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=True)
    generated_by = Column(String(50), default="gemini-2.5-flash")
