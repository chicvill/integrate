"""
apps/photos/backend/config.py
Configuration for Photos & Media Gallery inheriting from shared.core.base_config.
"""
import os
from pathlib import Path
from shared.core.base_config import BaseConfig


class PhotosConfig(BaseConfig):
    APP_ID: str = "photos"
    APP_NAME: str = "스마트 갤러리 (Immich AI)"
    APP_CATEGORY: str = "media"
    PORT: int = int(os.getenv("PORT", "8006"))

    PHOTOS_DIR: str = ""
    CACHE_DIR: str = ""
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_photos_unified_secret_key_2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./integrat.db")

    THUMB_WIDTH: int = 360
    THUMB_HEIGHT: int = 360
    THUMB_QUALITY: int = 75

    def __init__(self, **values):
        super().__init__(**values)
        self._init_paths()

    def _init_paths(self):
        # 1. Check environment variable
        env_photos = os.getenv("PHOTOS_DIR")
        if env_photos and os.path.exists(env_photos):
            self.PHOTOS_DIR = env_photos
        # 2. Check Windows L: drive
        elif os.name == "nt" and os.path.exists("L:/"):
            self.PHOTOS_DIR = "L:/"
        else:
            # 3. Standard isolated app storage directory (/media/photos/gallery or local fallback)
            self.PHOTOS_DIR = self.get_app_storage_dir("photos/gallery")

        # Cache directory
        env_cache = os.getenv("CACHE_DIR")
        if env_cache:
            self.CACHE_DIR = env_cache
        else:
            self.CACHE_DIR = self.get_app_storage_dir("photos/cache")

        os.makedirs(self.PHOTOS_DIR, exist_ok=True)
        os.makedirs(self.CACHE_DIR, exist_ok=True)


settings = PhotosConfig()


def get_settings() -> PhotosConfig:
    return settings
