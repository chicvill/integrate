"""apps/ai_gwansang/backend/models.py - AI 관상 전용 ORM 모델"""
import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, JSON, ForeignKey
from shared.core.base_database import Base, TimestampMixin, AppIdMixin


class GwansangAnalysis(Base, TimestampMixin, AppIdMixin):
    """관상 분석 결과 모델"""
    __tablename__ = "gwansang_analysis"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True)

    user_name = Column(String(100), nullable=True)

    # 이미지 정보
    image_url = Column(String(500), nullable=True)  # R2 저장 URL

    # AI 분석 결과
    animal_type = Column(String(100), nullable=True)
    overall_score = Column(Integer, nullable=True)
    personality = Column(Text, nullable=True)
    wealth_luck = Column(Text, nullable=True)
    career_luck = Column(Text, nullable=True)
    love_luck = Column(Text, nullable=True)
    health_luck = Column(Text, nullable=True)
    advice = Column(Text, nullable=True)
    raw_result = Column(JSON, nullable=True)

    # 결제 정보
    is_paid = Column(Boolean, default=False)
    payment_id = Column(String(200), nullable=True)

    # 다운로드
    pdf_url = Column(String(500), nullable=True)
