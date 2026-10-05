from shared.auth.router import auth_router, get_current_user_dependency, require_role, require_app_access
from shared.auth.service import AuthService
from shared.auth.models import User
from shared.auth.schemas import UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse
from shared.auth.session import (
    BaseAuthSession, StoreAuthSession, PhotosAuthSession,
    YTDownloadAuthSession, resolve_session_user
)

__all__ = [
    "auth_router", "get_current_user_dependency", "require_role", "require_app_access",
    "AuthService", "User",
    "UserRegisterRequest", "UserLoginRequest", "TokenResponse", "UserResponse",
    "BaseAuthSession", "StoreAuthSession", "PhotosAuthSession",
    "YTDownloadAuthSession", "resolve_session_user"
]
