"""
apps/store/backend/config.py
StoreConfig는 BaseConfig를 상속하여 매장 관리 전용 설정을 추가합니다.
"""
from shared.core.base_config import BaseConfig
from functools import lru_cache


class StoreConfig(BaseConfig):
    """매장 QR 주문 시스템 전용 설정"""
    APP_ID: str = "store"
    APP_NAME: str = "MQnet 매장 QR 주문 시스템"
    PORT: int = 8002

    # ─── 매장 전용 기능 플래그 ───────────────────────────
    ENABLE_QR_ORDER: bool = True
    ENABLE_KITCHEN_DISPLAY: bool = True
    ENABLE_TABLE_MANAGEMENT: bool = True
    ENABLE_PAYMENT: bool = True
    ENABLE_INVENTORY: bool = False

    # ─── 매장 전용 설정 ──────────────────────────────────
    MAX_TABLES: int = 100
    ORDER_TIMEOUT_MINUTES: int = 30
    QR_EXPIRE_HOURS: int = 24


@lru_cache()
def get_settings() -> StoreConfig:
    return StoreConfig()
