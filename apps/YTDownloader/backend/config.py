"""
apps/YTDownloader/backend/config.py
Configuration for YouTube Downloader inheriting from shared.core.BaseConfig.
"""
import os
from shared.core.base_config import BaseConfig


class YTDownloaderConfig(BaseConfig):
    APP_ID: str = "ytdownloader"
    APP_NAME: str = "유튜브 미디어 다운로더"
    APP_CATEGORY: str = "media"
    PORT: int = int(os.getenv("PORT", "8008"))

    ENABLE_AI_TRANSCRIPTION: bool = os.getenv("ENABLE_AI_TRANSCRIPTION", "true").lower() == "true"
    ENABLE_OFFLINE_SYNC: bool = os.getenv("ENABLE_OFFLINE_SYNC", "true").lower() == "true"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_ytdownloader_unified_secret_key_2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./ytdownloader.db")

    DOWNLOADS_DIR: str = os.path.join(os.path.dirname(__file__), "downloads")

    @property
    def is_standalone(self) -> bool:
        return self.DEPLOYMENT_MODE == "LOCAL_STANDALONE"


settings = YTDownloaderConfig()
os.makedirs(settings.DOWNLOADS_DIR, exist_ok=True)


def get_settings() -> YTDownloaderConfig:
    return settings
