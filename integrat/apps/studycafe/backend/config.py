"""
apps/studycafe/backend/config.py
StudyCafeConfig는 BaseConfig를 상속하여 스터디카페 전용 설정을 추가합니다.
"""
from shared.core.base_config import BaseConfig
from functools import lru_cache


class StudyCafeConfig(BaseConfig):
    """스터디카페 관리 시스템 전용 설정"""

    # 앱 식별자 (레지스트리 키와 동일해야 함)
    APP_ID: str = "studycafe"
    APP_NAME: str = "MQnet 스터디카페 관리 시스템"
    PORT: int = 8001

    # ─── 스터디카페 전용 기능 플래그 ─────────────────────
    ENABLE_NFC_DOOR: bool = True       # NFC 도어락 연동
    ENABLE_SELFSTUDY_MODULE: bool = True  # 자기주도학습 사이드 모듈
    ENABLE_SEAT_REALTIME: bool = True  # 좌석 실시간 현황

    # ─── 스터디카페 전용 설정 ────────────────────────────
    MAX_SEATS: int = 200
    DEFAULT_TICKET_TYPES: list = ["1시간권", "3시간권", "8시간권", "1일권", "월정액"]
    SEAT_ALERT_MINUTES: int = 10  # 이용권 만료 X분 전 알림

    # Gemini AI 오버라이드
    ENABLE_AI: bool = True  # 스터디카페는 AI 기능 기본 활성화


@lru_cache()
def get_settings() -> StudyCafeConfig:
    return StudyCafeConfig()
