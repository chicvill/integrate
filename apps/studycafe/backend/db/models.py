import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    pin = Column(String(10), nullable=True) # For local kiosk / NFC door authentication
    role = Column(String(20), default="STUDENT") # STUDENT, ADMIN, PARENT
    user_type = Column(String(20), default="GENERAL") # GENERAL or MANAGED
    total_time_remaining = Column(Integer, default=0) # Remaining minutes
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tickets = relationship("Ticket", back_populates="user")

class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    seat_number = Column(String(10), unique=True, index=True, nullable=False)
    zone_type = Column(String(20), default="NORMAL") # NORMAL, FOCUS, GROUP, MANAGED
    status = Column(String(20), default="EMPTY") # EMPTY, OCCUPIED, RESERVED, MAINTENANCE
    current_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    occupied_since = Column(DateTime, nullable=True)

    current_user = relationship("User", foreign_keys=[current_user_id])

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticket_type = Column(String(20), nullable=False) # TIME_PASS, DAY_PASS, MONTHLY_PASS
    minutes_granted = Column(Integer, default=0)
    price = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="tickets")

class DoorLog(Base):
    __tablename__ = "door_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    nfc_card_id = Column(String(50), nullable=True)
    action = Column(String(20), nullable=False) # ENTRY, EXIT, DENIED
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

