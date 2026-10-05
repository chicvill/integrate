"""
templates/saas-template/backend/config.py
MQnet 표준 SaaS 앱 전용 설정 모듈.
shared.core.base_config.BaseConfig를 상속하여 표준 환경변수 및 영구 볼륨 경로를 자동 제공합니다.
"""
import os
from shared.core.base_config import BaseConfig


class AppConfig(BaseConfig):
    APP_ID: str = "{{APP_ID}}"
    APP_NAME: str = "{{APP_NAME}}"
    APP_CATEGORY: str = "{{APP_CATEGORY}}"
    PORT: int = int(os.getenv("PORT", "8015")) if os.getenv("PORT", "{{APP_PORT}}") in ("{{APP_PORT}}", "") or not os.getenv("PORT", "{{APP_PORT}}").isdigit() else int(os.getenv("PORT", "{{APP_PORT}}"))

    # 앱 전용 비즈니스 설정
    ITEMS_PER_PAGE: int = 50
    ENABLE_AI_FEATURES: bool = True

    @property
    def STORAGE_DIR(self) -> str:
        """영구 마운트 볼륨(/media/{{APP_ID}}) 및 로컬 폴백 스토리지 자동 해석"""
        return self.get_app_storage_dir("{{APP_ID}}/data")

    @property
    def is_standalone(self) -> bool:
        return self.DEPLOYMENT_MODE == "LOCAL_STANDALONE"


settings = AppConfig()


def get_settings() -> AppConfig:
    return settings
