"""
apps/mqfarm/backend/config.py
Configuration for MQFarm inheriting from shared.core.BaseConfig.
"""
import os
from shared.core.base_config import BaseConfig


class MQFarmConfig(BaseConfig):
    APP_ID: str = "mqfarm"
    APP_NAME: str = "스마트팜 센서 관제"
    APP_CATEGORY: str = "iot"
    PORT: int = int(os.getenv("PORT", "8005"))

    ENABLE_GROWTH_AI: bool = os.getenv("ENABLE_GROWTH_AI", "true").lower() == "true"
    ENABLE_OFFLINE_SYNC: bool = os.getenv("ENABLE_OFFLINE_SYNC", "true").lower() == "true"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./integrat.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_mqfarm_unified_secret_key_2026")

    @property
    def is_standalone(self) -> bool:
        return self.DEPLOYMENT_MODE == "LOCAL_STANDALONE"


settings = MQFarmConfig()


def get_settings() -> MQFarmConfig:
    return settings
