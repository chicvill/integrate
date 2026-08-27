"""apps/ai_gwansang/backend/config.py - AI 관상 전용 설정"""
from shared.core.base_config import BaseConfig
from functools import lru_cache


class AiGwansangConfig(BaseConfig):
    APP_ID: str = "ai_gwansang"
    APP_NAME: str = "MQnet AI 관상 분석 서비스"
    PORT: int = 8005

    ENABLE_AI: bool = True
    ENABLE_PAYMENT: bool = True
    ENABLE_FILE_STORAGE: bool = True
    DAILY_FREE_COUNT: int = 3
    MAX_CONCURRENT_USERS: int = 50
    PDF_DOWNLOAD_ENABLED: bool = True


@lru_cache()
def get_settings() -> AiGwansangConfig:
    return AiGwansangConfig()
