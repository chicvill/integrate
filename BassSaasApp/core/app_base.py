"""
core/app_base.py — 모든 마이크로 SaaS 앱의 표준 부모 객체 `BaseSaaSApp`.

새 앱 = 이 클래스를 상속한 객체 1개.
게이트웨이는 앱의 내부를 몰라도 이 인터페이스만 보고 자동으로 마운트한다.

    class LaundryApp(BaseSaaSApp):
        app_id = "laundry"
        app_name = "스마트 무인빨래방"
        def get_router(self): return router

    app_instance = LaundryApp()
"""
import os
import re
import sys
from abc import ABC, abstractmethod
from typing import Any, ClassVar, Dict, List, Optional

from fastapi import APIRouter

APP_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,31}$")
RESERVED_IDS = frozenset({"api", "auth", "shared", "portal", "static", "docs", "redoc",
                          "openapi", "health", "admin", "core", "gateway"})
CATEGORIES = ("business", "education", "iot", "media", "utility", "ai", "portal")


class AppDefinitionError(ValueError):
    """앱 객체 정의가 플랫폼 규격을 위반했을 때."""


class BaseSaaSApp(ABC):
    # ── 필수 메타데이터 ──
    app_id: ClassVar[str] = ""
    app_name: ClassVar[str] = ""

    # ── 선택 메타데이터 (포털 카드 · 라우팅) ──
    icon: ClassVar[str] = "📦"
    category: ClassVar[str] = "business"
    description: ClassVar[str] = ""
    version: ClassVar[str] = "1.0.0"
    subdomains: ClassVar[List[str]] = []      # 예: ["laundry.example.com"]
    features: ClassVar[List[str]] = []
    order: ClassVar[int] = 100                # 포털 정렬 순서

    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            module = sys.modules.get(type(self).__module__)
            module_file = getattr(module, "__file__", None)
            base_dir = os.path.dirname(os.path.abspath(module_file)) if module_file else os.getcwd()
        self.base_dir = base_dir
        self.frontend_dir = os.path.join(base_dir, "frontend")
        self.data_dir = os.path.join(base_dir, "data")
        self.validate()

    # ── 규격 검증 (로더가 마운트 전에 호출) ──
    def validate(self) -> None:
        cls = type(self).__name__
        if not self.app_id or not APP_ID_PATTERN.match(self.app_id):
            raise AppDefinitionError(
                f"{cls}.app_id='{self.app_id}' 형식 오류: 영소문자로 시작, 영소문자/숫자/_ 2~32자여야 합니다.")
        if self.app_id in RESERVED_IDS:
            raise AppDefinitionError(f"{cls}.app_id='{self.app_id}'는 플랫폼 예약어입니다.")
        if not self.app_name.strip():
            raise AppDefinitionError(f"{cls}.app_name 이 비어 있습니다.")
        if self.category not in CATEGORIES:
            raise AppDefinitionError(
                f"{cls}.category='{self.category}' 는 허용되지 않습니다. 허용값: {', '.join(CATEGORIES)}")

    # ── 앱이 반드시 구현해야 하는 단 하나 ──
    @abstractmethod
    def get_router(self) -> APIRouter:
        """앱 전용 API 라우터. 게이트웨이가 /api/{app_id} 에 자동 마운트한다."""

    # ── 선택 구현 ──
    def get_static_dir(self) -> Optional[str]:
        """정적 프론트엔드 경로 (기본: <앱>/frontend 또는 index.html 이 있는 루트 폴더). 없으면 API 전용 앱."""
        if os.path.isdir(self.frontend_dir):
            return self.frontend_dir
        if os.path.exists(os.path.join(self.base_dir, "index.html")):
            return self.base_dir
        return None

    def on_startup(self) -> None:
        """기동 시 1회: 시드 데이터 보장, 외부 연결 등."""

    def on_shutdown(self) -> None:
        """종료 시: 리소스 정리."""

    def health_check(self) -> Dict[str, Any]:
        """앱별 추가 진단 정보 (예: 가동 중 장비 수). 예외를 던지면 DEGRADED 로 표시된다."""
        return {}

    # ── 플랫폼이 사용하는 표준 표현 ──
    def health(self) -> Dict[str, Any]:
        try:
            extra = self.health_check() or {}
            return {"app_id": self.app_id, "status": "HEALTHY", **extra}
        except Exception as e:  # 진단 실패도 숨기지 않고 사유를 노출
            return {"app_id": self.app_id, "status": "DEGRADED", "reason": str(e)}

    def portal_meta(self) -> Dict[str, Any]:
        return {
            "app_id": self.app_id,
            "app_name": self.app_name,
            "icon": self.icon,
            "category": self.category,
            "description": self.description,
            "version": self.version,
            "features": list(self.features),
            "route_path": f"/{self.app_id}/" if self.get_static_dir() else None,
            "api_path": f"/api/{self.app_id}",
            "manual_path": f"/{self.app_id}/manual.html"
            if self.get_static_dir() and os.path.exists(os.path.join(self.frontend_dir, "manual.html")) else None,
            "order": self.order,
        }

    def __repr__(self) -> str:
        return f"<{type(self).__name__} app_id={self.app_id!r}>"
