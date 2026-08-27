"""
apps/photos/backend/config.py
Configuration for Photos & Media Gallery using shared base configuration.
"""
import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()


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


class Settings(BaseModel):
    # Media & Cache Directories
    PHOTOS_DIR: str = get_default_photos_dir()
    CACHE_DIR: str = os.getenv("CACHE_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache"))
    
    # Server & Security
    DEPLOYMENT_MODE: str = os.getenv("DEPLOYMENT_MODE", "LOCAL_STANDALONE").upper()
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8006"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./integrat.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_photos_unified_secret_key_2026")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Thumbnail Settings
    THUMB_WIDTH: int = 360
    THUMB_HEIGHT: int = 360
    THUMB_QUALITY: int = 72


settings = Settings()

# Ensure cache directory exists
os.makedirs(settings.CACHE_DIR, exist_ok=True)


def get_settings():
    return settings
