"""
apps/studycafe/backend/models.py
스터디카페 전용 ORM 모델 (오리지널 studycafe 컨셉 100% 반영).
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from shared.core.base_database import Base, TimestampMixin, AppIdMixin


class StudyCafeUser(Base, TimestampMixin):
    """스터디카페 회원 모델 (오리지널 컨셉: 일반/관리형 회원)"""
    __tablename__ = "studycafe_users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(100), default="studycafe-main", index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=False, index=True)
    user_type = Column(String(20), default="GENERAL")  # 'GENERAL' (일반) | 'MANAGED' (관리형)
    pin_code = Column(String(10), nullable=True)
    is_active = Column(Boolean, default=True)


class Seat(Base, TimestampMixin):
    """스터디카페 구역별 좌석 모델 (A-01 ~ A-20, FOCUS / NORMAL / LAPTOP)"""
    __tablename__ = "studycafe_seats"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(100), default="studycafe-main", nullable=False, index=True)
    seat_number = Column(String(20), nullable=False, index=True)  # 'A-01' ~ 'A-20'
    zone_type = Column(String(50), default="NORMAL")  # 'FOCUS', 'NORMAL', 'LAPTOP'
    seat_type = Column(String(50), default="general")  # 호환용
    status = Column(String(20), default="EMPTY")  # 'EMPTY', 'OCCUPIED', 'RESERVED'
    is_occupied = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)
    
    # 점유자 정보
    current_user_id = Column(String(36), nullable=True)
    current_user_name = Column(String(100), nullable=True)
    current_user_phone = Column(String(50), nullable=True)
    current_user_type = Column(String(20), default="GENERAL")  # GENERAL / MANAGED
    
    qr_code = Column(String(200), nullable=True)
    nfc_tag_id = Column(String(100), nullable=True)


class Ticket(Base, TimestampMixin):
    """이용권 모델"""
    __tablename__ = "studycafe_tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    tenant_id = Column(String(100), default="studycafe-main", nullable=False, index=True)
    ticket_type = Column(String(50), nullable=False)  # "2시간권", "50시간권", "4주권"
    duration_minutes = Column(Integer, nullable=True)
    remaining_minutes = Column(Integer, nullable=True)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    price = Column(Integer, default=0)


class StudyCafeSession(Base, TimestampMixin):
    """이용 세션 (입실/퇴실 기록)"""
    __tablename__ = "studycafe_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    user_name = Column(String(100), nullable=True)
    user_phone = Column(String(50), nullable=True)
    user_type = Column(String(20), default="GENERAL")
    seat_id = Column(String(36), nullable=True)
    seat_number = Column(String(20), nullable=True)
    ticket_id = Column(String(36), nullable=True)
    tenant_id = Column(String(100), default="studycafe-main", nullable=False)
    check_in_at = Column(DateTime(timezone=True), nullable=False)
    check_out_at = Column(DateTime(timezone=True), nullable=True)
    used_minutes = Column(Integer, default=0)
