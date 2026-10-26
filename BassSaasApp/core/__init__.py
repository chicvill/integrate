"""
core — BassSaasApp 플랫폼 커널.

앱 개발자가 import 하는 것은 거의 이것뿐이다:
    from core import BaseSaaSApp, Obj, DomainError, Conflict, Mismatch, require_role
"""
from .app_base import AppDefinitionError, BaseSaaSApp
from .auth import current_user, require_role, require_user
from .errors import Conflict, DomainError, Forbidden, Mismatch, NotFound
from .kernel import Obj, actor, store, use_store

from .gateway import create_gateway

__all__ = [
    "BaseSaaSApp", "AppDefinitionError",
    "Obj", "actor", "store", "use_store",
    "DomainError", "NotFound", "Conflict", "Mismatch", "Forbidden",
    "current_user", "require_user", "require_role",
    "create_gateway",
]
