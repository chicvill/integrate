"""
apps/files/backend/config.py
Configuration for MQnet Files Hub inheriting from shared.core.BaseConfig.
"""
import os
from pathlib import Path
from shared.core.base_config import BaseConfig


class FilesConfig(BaseConfig):
    APP_ID: str = "files"
    APP_NAME: str = "MQnet 통합 파일 스토리지 허브"
    APP_CATEGORY: str = "utility"
    PORT: int = int(os.getenv("FILES_PORT", os.getenv("PORT", "8011")))

    # 스토리지 루트 경로
    STORAGE_ROOT: str = ""
    # 허용 업로드 최대 크기 (바이트 단위, 기본 2GB)
    MAX_UPLOAD_SIZE: int = int(os.getenv("MAX_UPLOAD_SIZE", str(2 * 1024 * 1024 * 1024)))
    # 미리보기 허용 텍스트 파일 최대 크기 (5MB)
    MAX_TEXT_PREVIEW_SIZE: int = 5 * 1024 * 1024

    def __init__(self, **values):
        super().__init__(**values)
        self._init_storage()

    def _init_storage(self):
        # 1. 환경 변수 지정 확인
        env_media = os.getenv("MEDIA_STORAGE_PATH", os.getenv("MEDIA_PATH"))
        if env_media and os.path.exists(env_media):
            self.STORAGE_ROOT = env_media
        # 2. Windows L: 드라이브 확인
        elif os.name == "nt" and os.path.exists("L:/"):
            self.STORAGE_ROOT = "L:/"
        else:
            # 3. shared/core 기본 스토리지 또는 프로젝트 내 media 폴더
            self.STORAGE_ROOT = self.get_app_storage_dir("")
            if not self.STORAGE_ROOT or not os.path.exists(self.STORAGE_ROOT):
                fallback = os.path.abspath(
                    os.path.join(os.path.dirname(__file__), "..", "..", "..", "media")
                )
                os.makedirs(fallback, exist_ok=True)
                self.STORAGE_ROOT = fallback

        os.makedirs(self.STORAGE_ROOT, exist_ok=True)


settings = FilesConfig()


def get_settings() -> FilesConfig:
    return settings
