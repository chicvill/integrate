# shared.core - 공통 기반 클래스 및 핵심 엔진
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
from shared.core.responses import (
    ApiResponse,
    success_response,
    error_response,
)

__all__ = [
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
]
