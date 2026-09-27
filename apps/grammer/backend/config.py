"""
apps/grammer/backend/config.py
Configuration for Grammar Quest inheriting from shared.core.BaseConfig.
"""
import os
from shared.core.base_config import BaseConfig


class GrammerConfig(BaseConfig):
    APP_ID: str = "grammer"
    APP_NAME: str = "Grammar Quest (AI 영문법 퀘스트)"
    APP_CATEGORY: str = "education"
    PORT: int = int(os.getenv("PORT", "9014"))

    ENABLE_AI_TUTOR: bool = os.getenv("ENABLE_AI_TUTOR", "true").lower() == "true"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./integrat.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_grammer_unified_secret_key_2026")


settings = GrammerConfig()


def get_settings() -> GrammerConfig:
    return settings
