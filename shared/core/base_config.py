"""
shared/core/base_config.py
모든 SaaS 앱이 공통으로 상속하는 기반 설정 클래스.

상속 예시:
    from shared.core.base_config import BaseConfig

    class StudyCafeConfig(BaseConfig):
        APP_ID: str = "studycafe"
        ENABLE_NFC_DOOR: bool = True
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class BaseConfig(BaseSettings):
    """모든 MQnet SaaS 앱의 공통 기반 설정 클래스"""

    # ─── 앱 식별 ─────────────────────────────────────────
    APP_ID: str = "base"
    APP_NAME: str = "MQnet Base App"
    APP_VERSION: str = "1.0.0"
    DEPLOYMENT_MODE: str = os.getenv("DEPLOYMENT_MODE", "LOCAL_STANDALONE").upper()

    # ─── 서버 ────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["*"]

    # ─── 데이터베이스 (Supabase/PostgreSQL 공통) ─────────
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./integrat.db")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    # ─── 인증/보안 (모든 앱 공통) ────────────────────────
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-this-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

    # ─── AI (Gemini) ─────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = "gemini-2.5-flash"
    ENABLE_AI: bool = os.getenv("ENABLE_AI", "false").lower() == "true"

    # ─── 결제 (Stripe & TossPayments) ─────────────────────
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    TOSS_CLIENT_KEY: str = os.getenv("TOSS_CLIENT_KEY", "")
    TOSS_SECRET_KEY: str = os.getenv("TOSS_SECRET_KEY", "")
    ENABLE_PAYMENT: bool = os.getenv("ENABLE_PAYMENT", "false").lower() == "true"

    # ─── 파일 저장소 (Cloudflare R2 & Local) ──────────────
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "mqnet-uploads")
    UPLOADS_DIR: str = os.getenv("UPLOADS_DIR", "uploads")
    ENABLE_FILE_STORAGE: bool = os.getenv("ENABLE_FILE_STORAGE", "false").lower() == "true"

    # ─── 알림 ────────────────────────────────────────────
    KAKAO_API_KEY: str = os.getenv("KAKAO_API_KEY", "")
    ENABLE_NOTIFICATIONS: bool = os.getenv("ENABLE_NOTIFICATIONS", "false").lower() == "true"

    # ─── 공통 SaaS 쿼터 & 카테고리 ─────────────────────────
    DAILY_FREE_LIMIT: int = int(os.getenv("DAILY_FREE_LIMIT", "5"))
    APP_CATEGORY: str = os.getenv("APP_CATEGORY", "general")

    # ─── 공통 기능 플래그 ─────────────────────────────────
    ENABLE_CLOUD_SYNC: bool = os.getenv("ENABLE_CLOUD_SYNC", "false").lower() == "true"
    ENABLE_REALTIME: bool = os.getenv("ENABLE_REALTIME", "false").lower() == "true"

    class Config:
        env_file = (".env.shared", ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

    def get_app_info(self) -> dict:
        """앱 기본 정보 반환 (헬스체크 등에 사용)"""
        return {
            "app_id": self.APP_ID,
            "app_name": self.APP_NAME,
            "version": self.APP_VERSION,
            "category": self.APP_CATEGORY,
            "deployment_mode": self.DEPLOYMENT_MODE,
            "daily_free_limit": self.DAILY_FREE_LIMIT,
            "features": {
                "ai": self.ENABLE_AI,
                "payment": self.ENABLE_PAYMENT,
                "file_storage": self.ENABLE_FILE_STORAGE,
                "notifications": self.ENABLE_NOTIFICATIONS,
                "realtime": self.ENABLE_REALTIME,
            },
        }


@lru_cache()
def get_base_settings() -> BaseConfig:
    """싱글톤으로 설정 객체 반환"""
    return BaseConfig()
