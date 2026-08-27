"""apps/selfstudy/backend/config.py - 자기주도학습 전용 설정"""
from shared.core.base_config import BaseConfig
from functools import lru_cache


class SelfStudyConfig(BaseConfig):
    APP_ID: str = "selfstudy"
    APP_NAME: str = "MQnet 자기주도학습 관리 시스템"
    PORT: int = 8003

    ENABLE_AI: bool = True
    ENABLE_PARENT_DASHBOARD: bool = True
    ENABLE_TEACHER_MONITORING: bool = True
    ENABLE_NOTIFICATIONS: bool = True
    MAX_STUDENTS_PER_TEACHER: int = 50
    SUBJECTS: list = ["국어", "영어", "수학", "과학", "사회", "도덕", "예체능"]


@lru_cache()
def get_settings() -> SelfStudyConfig:
    return SelfStudyConfig()
