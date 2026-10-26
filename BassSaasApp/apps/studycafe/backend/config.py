"""
apps/studycafe/backend/config.py
Configuration for StudyCafe inheriting from shared.core.BaseConfig.
"""
import os
from shared.core.base_config import BaseConfig


class StudyCafeConfig(BaseConfig):
    APP_ID: str = "studycafe"
    APP_NAME: str = "스터디카페 관리"
    APP_CATEGORY: str = "business"
    PORT: int = int(os.getenv("PORT", "8001"))

    # Features
    ENABLE_SELFSTUDY: bool = os.getenv("ENABLE_SELFSTUDY", "true").lower() == "true"
    ENABLE_NFC_DOOR: bool = os.getenv("ENABLE_NFC_DOOR", "true").lower() == "true"

    # Database & Security
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./integrat.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_studycafe_unified_secret_key_2026")

    # IoT & MQTT
    MQTT_BROKER_HOST: str = os.getenv("MQTT_BROKER_HOST", "localhost")
    MQTT_BROKER_PORT: int = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    MQTT_TOPIC_DOOR: str = os.getenv("MQTT_TOPIC_DOOR", "studycafe/door/control")

    @property
    def is_standalone(self) -> bool:
        return self.DEPLOYMENT_MODE == "LOCAL_STANDALONE"


settings = StudyCafeConfig()


def get_settings() -> StudyCafeConfig:
    return settings
