"""
apps/photos/backend/config.py
Configuration for Photos & Media Gallery inheriting from shared.core.BaseConfig.
"""
import os
from shared.core.base_config import BaseConfig


def get_default_photos_dir() -> str:
    # 1. Check environment variable
    env_dir = os.getenv("PHOTOS_DIR")
    if env_dir and os.path.exists(env_dir):
        return env_dir

    # 2. Check Windows L:\ drive
    if os.name == "nt" and os.path.exists("L:/"):
        return "L:/"

    # 3. Check /media (Docker/Linux)
    if os.path.exists("/media"):
        return "/media"

    # 4. Fallback to local media folder
    local_media = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media")
    os.makedirs(local_media, exist_ok=True)
    return local_media


class PhotosConfig(BaseConfig):
    APP_ID: str = "photos"
    APP_NAME: str = "스마트 갤러리 (Immich AI)"
    APP_CATEGORY: str = "media"
    PORT: int = int(os.getenv("PORT", "8006"))

    PHOTOS_DIR: str = get_default_photos_dir()
    CACHE_DIR: str = os.getenv("CACHE_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_photos_unified_secret_key_2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./integrat.db")

    THUMB_WIDTH: int = 360
    THUMB_HEIGHT: int = 360
    THUMB_QUALITY: int = 72


settings = PhotosConfig()
os.makedirs(settings.CACHE_DIR, exist_ok=True)


def get_settings() -> PhotosConfig:
    return settings
