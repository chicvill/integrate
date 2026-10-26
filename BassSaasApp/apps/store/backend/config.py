"""
apps/store/backend/config.py
Configuration for Store POS & QR Ordering inheriting from shared.core.BaseConfig.
"""
import os
from shared.core.base_config import BaseConfig


class StoreConfig(BaseConfig):
    APP_ID: str = "store"
    APP_NAME: str = "매장 QR 주문 & POS"
    APP_CATEGORY: str = "business"
    PORT: int = int(os.getenv("PORT", "8002"))

    ENABLE_AI_ANALYTICS: bool = os.getenv("ENABLE_AI_ANALYTICS", "true").lower() == "true"
    ENABLE_OFFLINE_SYNC: bool = os.getenv("ENABLE_OFFLINE_SYNC", "true").lower() == "true"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./integrat.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_store_unified_secret_key_2026")

    @property
    def is_standalone(self) -> bool:
        return self.DEPLOYMENT_MODE == "LOCAL_STANDALONE"


settings = StoreConfig()


def get_settings() -> StoreConfig:
    return settings
