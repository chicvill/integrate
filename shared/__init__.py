"""
MQnet 통합 SaaS 플랫폼 - 통합 공통 라이브러리 (shared)
버전: 2.0.0

모든 SaaS 앱 개발 시 공통적으로 사용되는 코어 엔진, AI, 결제, 스토리지,
인증, 이벤트 버스, 보안 유틸리티를 통합 제공합니다.

하위 호환성을 완벽히 보장하여 기존 모듈 경로 임포트와 최상위 Facade 임포트를
동시에 지원합니다.
"""

__version__ = "2.0.0"

# ─── Core Engine ─────────────────────────────────────────────
from shared.core.base_config import BaseConfig, get_base_settings
from shared.core.base_database import (
    BaseDatabase,
    Base,
    TimestampMixin,
    AppIdMixin,
    get_db,
    db_session,
    init_database,
    get_database_service,
)
from shared.core.base_app import create_base_app
from shared.core.exceptions import (
    AppException,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    RateLimitError,
    ServiceUnavailableError,
)
from shared.core.responses import ApiResponse, success_response, error_response

# ─── AI Services ─────────────────────────────────────────────
from shared.ai.base import BaseAIClient
from shared.ai.gemini_client import GeminiClient
from shared.ai.mock_client import MockAIClient

# ─── File Storage ────────────────────────────────────────────
from shared.storage.base import BaseStorageService
from shared.storage.local_storage import LocalStorageService
from shared.storage.r2_storage import R2StorageService
from shared.storage import get_storage_service

# ─── Payment & Billing ───────────────────────────────────────
from shared.payment.base import BasePaymentService
from shared.payment.stripe_client import StripePaymentService
from shared.payment.toss_client import TossPaymentService

# ─── Realtime Events & SSE ───────────────────────────────────
from shared.events.event_bus import EventBus, get_event_bus, global_event_bus

# ─── Authentication & Multi-Tenancy ─────────────────────────
from shared.auth.service import AuthService
from shared.auth.models import User
from shared.auth.router import auth_router, get_current_user_dependency

# ─── Utilities ───────────────────────────────────────────────
from shared.utils.logger import setup_logger
from shared.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    generate_short_code,
    generate_secure_token,
)
from shared.utils.qr_generator import generate_qr_base64, generate_table_qr

__all__ = [
    "__version__",
    # Core
    "BaseConfig",
    "get_base_settings",
    "BaseDatabase",
    "Base",
    "TimestampMixin",
    "AppIdMixin",
    "get_db",
    "db_session",
    "init_database",
    "get_database_service",
    "create_base_app",
    "AppException",
    "NotFoundError",
    "UnauthorizedError",
    "ForbiddenError",
    "ConflictError",
    "RateLimitError",
    "ServiceUnavailableError",
    "ApiResponse",
    "success_response",
    "error_response",
    # AI
    "BaseAIClient",
    "GeminiClient",
    "MockAIClient",
    # Storage
    "BaseStorageService",
    "LocalStorageService",
    "R2StorageService",
    "get_storage_service",
    # Payment
    "BasePaymentService",
    "StripePaymentService",
    "TossPaymentService",
    # Events
    "EventBus",
    "get_event_bus",
    "global_event_bus",
    # Auth
    "AuthService",
    "User",
    "auth_router",
    "get_current_user_dependency",
    # Utils
    "setup_logger",
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "generate_short_code",
    "generate_secure_token",
    "generate_qr_base64",
    "generate_table_qr",
]
