"""apps/smartfarm/backend/models.py - 스마트팜 전용 ORM 모델"""
import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Text
from shared.core.base_database import Base, TimestampMixin


class Farm(Base, TimestampMixin):
    """농장 모델"""
    __tablename__ = "smartfarm_farms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), nullable=False, default="admin")


    tenant_id = Column(String(100), nullable=False, index=True)
    farm_name = Column(String(200), nullable=False)
    location = Column(String(500), nullable=True)
    farm_type = Column(String(100), default="greenhouse")  # greenhouse, outdoor, indoor
    crop_types = Column(JSON, nullable=True)  # ["딸기", "토마토"]
    total_area_sqm = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)


class Sensor(Base, TimestampMixin):
    """센서 모델"""
    __tablename__ = "smartfarm_sensors"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("smartfarm_farms.id"), nullable=False)
    sensor_name = Column(String(100), nullable=False)
    sensor_type = Column(String(50), nullable=False)
    # sensor_type: temperature | humidity | co2 | light | soil_moisture | ec | ph
    unit = Column(String(20), nullable=True)  # "°C", "%", "ppm", "lux"
    min_threshold = Column(Float, nullable=True)
    max_threshold = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    location_in_farm = Column(String(100), nullable=True)


class SensorReading(Base, TimestampMixin):
    """센서 측정값 모델 (시계열 데이터)"""
    __tablename__ = "smartfarm_sensor_readings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sensor_id = Column(String(36), ForeignKey("smartfarm_sensors.id"), nullable=False)
    farm_id = Column(String(36), nullable=False, index=True)
    value = Column(Float, nullable=False)
    is_alert = Column(Boolean, default=False)
    alert_message = Column(Text, nullable=True)


class ControlDevice(Base, TimestampMixin):
    """제어 장치 모델"""
    __tablename__ = "smartfarm_control_devices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("smartfarm_farms.id"), nullable=False)
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(50), nullable=False)
    # device_type: fan | irrigation | lighting | heater | shade
    is_on = Column(Boolean, default=False)
    auto_mode = Column(Boolean, default=True)
    last_controlled_at = Column(DateTime(timezone=True), nullable=True)


class FarmMaterial(Base, TimestampMixin):
    """농자재 재고 모델"""
    __tablename__ = "smartfarm_materials"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("smartfarm_farms.id"), nullable=False)
    material_name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=True)  # fertilizer, pesticide, seed
    quantity = Column(Float, default=0)
    unit = Column(String(20), default="kg")
    alert_threshold = Column(Float, nullable=True)
