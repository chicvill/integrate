"""
apps/smartfarm/backend/db/models.py
Original chicvill/smartfarm ORM models mapped with shared Base.
"""
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from apps.smartfarm.backend.db.database import Base


class Farm(Base):
    __tablename__ = "farms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    location = Column(String(200), nullable=True)
    crop_type = Column(String(50), default="딸기(설향)")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sensors = relationship("SensorReading", back_populates="farm")
    actuators = relationship("ActuatorLog", back_populates="farm")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)
    temperature = Column(Float, nullable=False)   # 온도 (°C)
    humidity = Column(Float, nullable=False)      # 습도 (%)
    co2 = Column(Float, nullable=False)           # CO2 (ppm)
    light_lux = Column(Float, nullable=False)     # 조도 (lux)
    soil_moisture = Column(Float, nullable=True) # 토양수분 (%)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    farm = relationship("Farm", back_populates="sensors")


class ActuatorLog(Base):
    __tablename__ = "actuator_logs"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)
    device_name = Column(String(50), nullable=False)   # FAN, PUMP, LED, HEATER
    status = Column(String(20), nullable=False)        # ON, OFF
    trigger_type = Column(String(20), default="MANUAL") # AUTO, MANUAL
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    farm = relationship("Farm", back_populates="actuators")


class GrowthLog(Base):
    __tablename__ = "growth_logs"

    id = Column(Integer, primary_key=True, index=True)
    crop_name = Column(String(100), default="딸기(설향)")
    overall_status = Column(String(50), default="HEALTHY")
    health_score = Column(Integer, default=95)
    summary = Column(Text, nullable=False)
    risk_factor = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
