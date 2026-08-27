"""
apps/studycafe/backend/models.py
스터디카페 전용 ORM 모델 (공통 User 모델 외 추가).
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from shared.core.base_database import Base, TimestampMixin, AppIdMixin


class Seat(Base, TimestampMixin):
    """좌석 모델"""
    __tablename__ = "studycafe_seats"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(100), nullable=False, index=True)  # 어떤 스터디카페 지점인지
    seat_number = Column(String(20), nullable=False)
    seat_type = Column(String(50), default="general")  # general, private, group
    is_occupied = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)
    current_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    qr_code = Column(String(200), nullable=True)
    nfc_tag_id = Column(String(100), nullable=True)


class Ticket(Base, TimestampMixin):
    """이용권 모델"""
    __tablename__ = "studycafe_tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(String(100), nullable=False, index=True)
    ticket_type = Column(String(50), nullable=False)  # "1시간권", "월정액" 등
    duration_minutes = Column(Integer, nullable=True)  # 시간제 이용권의 경우
    remaining_minutes = Column(Integer, nullable=True)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    price = Column(Integer, default=0)


class StudyCafeSession(Base, TimestampMixin):
    """이용 세션 (입실/퇴실 기록)"""
    __tablename__ = "studycafe_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    seat_id = Column(String(36), ForeignKey("studycafe_seats.id"), nullable=True)
    ticket_id = Column(String(36), ForeignKey("studycafe_tickets.id"), nullable=True)
    tenant_id = Column(String(100), nullable=False)
    check_in_at = Column(DateTime(timezone=True), nullable=False)
    check_out_at = Column(DateTime(timezone=True), nullable=True)
    used_minutes = Column(Integer, default=0)
