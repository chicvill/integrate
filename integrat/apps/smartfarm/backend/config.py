"""apps/smartfarm/backend/config.py - 스마트팜 전용 설정"""
from shared.core.base_config import BaseConfig
from functools import lru_cache


class SmartFarmConfig(BaseConfig):
    APP_ID: str = "smartfarm"
    APP_NAME: str = "MQnet 스마트팜 제어 시스템"
    PORT: int = 8004

    ENABLE_SENSOR_MONITORING: bool = True
    ENABLE_AUTO_CONTROL: bool = True
    ENABLE_ALERT_SYSTEM: bool = True
    ENABLE_AI: bool = True
    ENABLE_REALTIME: bool = True
    SENSOR_POLL_INTERVAL_SECONDS: int = 30
    ALERT_TEMP_MAX: float = 35.0
    ALERT_TEMP_MIN: float = 5.0
    ALERT_HUMIDITY_MAX: float = 90.0
    ALERT_HUMIDITY_MIN: float = 30.0


@lru_cache()
def get_settings() -> SmartFarmConfig:
    return SmartFarmConfig()
