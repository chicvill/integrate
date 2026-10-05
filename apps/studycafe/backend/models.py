"""
apps/studycafe/backend/models.py
스터디카페 전용 ORM 모델 (SQLAlchemy 2.0 Mapped 타입 완벽 지원).
"""
import uuid
import datetime
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from shared.core.base_database import Base, TimestampMixin


class StudyCafeUser(Base, TimestampMixin):
    """스터디카페 회원 모델 (일반/관리형 회원)"""
    __tablename__ = "studycafe_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(100), default="studycafe-main", index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_type: Mapped[str] = mapped_column(String(20), default="GENERAL")  # 'GENERAL' (일반) | 'MANAGED' (관리형)
    pin_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # 🎯 청소년 보호 및 벌점 관리
    birth_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # YYYY-MM-DD
    is_minor: Mapped[bool] = mapped_column(Boolean, default=False)       # 22:00 심야 셧다운 대상
    night_exempt: Mapped[bool] = mapped_column(Boolean, default=False)   # 22시 심야 이용 예외 승인 여부
    parent_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    penalty_points: Mapped[int] = mapped_column(Integer, default=0)


class Seat(Base, TimestampMixin):
    """스터디카페 구역별 좌석 모델 (A-01 ~ A-20, FOCUS / NORMAL / LAPTOP)"""
    __tablename__ = "studycafe_seats"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(100), default="studycafe-main", nullable=False, index=True)
    seat_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # 'A-01' ~ 'A-20'
    zone_type: Mapped[str] = mapped_column(String(50), default="NORMAL")  # 'FOCUS', 'NORMAL', 'LAPTOP'
    seat_type: Mapped[str] = mapped_column(String(50), default="general")  # 호환용
    status: Mapped[str] = mapped_column(String(20), default="EMPTY")  # 'EMPTY', 'OCCUPIED', 'STEP_OUT', 'RESERVED'
    is_occupied: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # 점유자 정보
    current_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    current_user_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_user_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    current_user_type: Mapped[str] = mapped_column(String(20), default="GENERAL")  # GENERAL / MANAGED
    step_out_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # 외출 시작 시각
    
    qr_code: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    nfc_tag_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class Ticket(Base, TimestampMixin):
    """이용권 모델"""
    __tablename__ = "studycafe_tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(100), default="studycafe-main", nullable=False, index=True)
    ticket_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "2시간권", "50시간권", "4주권"
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    remaining_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    valid_from: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    price: Mapped[int] = mapped_column(Integer, default=0)

    # 🎯 이용권 일시정지(Hold) 관리 (최대 2회, 총 14일)
    is_held: Mapped[bool] = mapped_column(Boolean, default=False)
    hold_started_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    hold_count: Mapped[int] = mapped_column(Integer, default=0)
    hold_total_days: Mapped[int] = mapped_column(Integer, default=0)


class StudyCafeSession(Base, TimestampMixin):
    """이용 세션 (입실/퇴실 기록)"""
    __tablename__ = "studycafe_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    user_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_type: Mapped[str] = mapped_column(String(20), default="GENERAL")
    seat_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    seat_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    ticket_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    tenant_id: Mapped[str] = mapped_column(String(100), default="studycafe-main", nullable=False)
    check_in_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    check_out_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    used_minutes: Mapped[int] = mapped_column(Integer, default=0)


class PatrolLog(Base, TimestampMixin):
    """현장 순찰 기록 모델 (졸음, 딴짓, 이탈, 태도 우수 등)"""
    __tablename__ = "studycafe_patrol_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(100), default="studycafe-main", nullable=False, index=True)
    seat_number: Mapped[str] = mapped_column(String(20), nullable=False)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    user_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    user_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # 'SLEEP'(졸음), 'DISTRACTION'(폰/딴짓), 'AWAY'(무단이탈), 'FOCUS'(집중우수)
    penalty: Mapped[int] = mapped_column(Integer, default=0)           # 벌점 (+1, +2, 0)
    note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    manager_name: Mapped[str] = mapped_column(String(50), default="관리실장")
