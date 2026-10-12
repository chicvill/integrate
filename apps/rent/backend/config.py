"""
apps/rent/backend/config.py
MQnet 표준 SaaS 앱 전용 설정 모듈 - 원룸 임차료 관리 시스템 (29개실)
"""
import os
from shared.core.base_config import BaseConfig


class RentConfig(BaseConfig):
    APP_ID: str = "rent"
    APP_NAME: str = "원룸 임차료 관리 시스템 (29개실)"
    APP_CATEGORY: str = "estate"
    PORT: int = int(os.getenv("PORT", "9015"))

    DEFAULT_BRANCH_ID: str = "main"
    DEFAULT_BRANCH_NAME: str = "시크빌 (29개실)"

    @property
    def STORAGE_DIR(self) -> str:
        return self.get_app_storage_dir("rent/data")

    @property
    def is_standalone(self) -> bool:
        return self.DEPLOYMENT_MODE == "LOCAL_STANDALONE"


settings = RentConfig()


def get_settings() -> RentConfig:
    return settings
