"""
core/gateway.py — 제로터치 통합 게이트웨이 팩토리.

BaseSaaSApp 객체를 자동 발견하여 마운트하는 FastAPI 게이트웨이 생성기.
core 패키지에 내장되어 다른 워크스페이스의 gateway 패키지와 네임스페이스 충돌을 방지합니다.
"""
import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from .auth import auth_router, ensure_default_admins, require_role, verify_token
from .errors import DomainError
from .kernel import actor, store, use_store
from .loader import SaaSAppManager
from .web import NoCacheStaticFiles

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_APPS_ROOT = os.path.join(ROOT, "apps")
DEFAULT_DB = os.path.join(ROOT, "data", "platform.db")
PORTAL_DIR = os.path.join(ROOT, "gateway", "portal")
SHARED_UI_DIR = os.path.join(ROOT, "shared_ui")

logger = logging.getLogger("bass.gateway")


def create_gateway(apps_root: Optional[str] = None, db_path: Optional[str] = None,
                   only: Optional[List[str]] = None, standalone: bool = False) -> FastAPI:
    """게이트웨이 팩토리. 테스트는 apps_root/db_path 를 바꿔 격리된 인스턴스를 만든다."""
    use_store(db_path or os.getenv("BASS_DB") or DEFAULT_DB)
    ensure_default_admins()
    manager = SaaSAppManager()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        manager.shutdown()

    title = "BassSaasApp Gateway" if not standalone else f"BassSaasApp Standalone — {', '.join(only or [])}"
    app = FastAPI(title=title, version="1.0.0", lifespan=lifespan,
                  description="BaseSaaSApp 객체를 자동 발견하여 마운트하는 제로터치 멀티앱 SaaS 게이트웨이")
    app.state.manager = manager

    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    _install_error_handlers(app)
    _install_middlewares(app, manager)

    # ── 플랫폼 공통 API ──
    app.include_router(auth_router, prefix="/auth", tags=["🔐 공통 인증"])

    @app.get("/api/apps", tags=["🧭 플랫폼"])
    def list_apps():
        """포털이 렌더링할 앱 카탈로그 (정상 / 격리 / 비활성)."""
        return manager.catalog()

    @app.get("/api/health", tags=["🧭 플랫폼"])
    def health():
        return manager.health()

    @app.get("/api/timeline", tags=["🧭 플랫폼"],
             dependencies=[Depends(require_role("superadmin", "admin"))])
    def timeline(app_id: str = "", limit: int = 50):
        """전체 앱 변경 이력 (관리자 전용). app_id 지정 시 해당 앱만."""
        prefix = f"{app_id}." if app_id else ""
        return {"success": True, "events": store().history(prefix, None, min(max(limit, 1), 500))}

    # ── 앱 자동 발견 & 마운트 ──
    manager.discover_and_mount(app, apps_root or DEFAULT_APPS_ROOT, only=only, standalone=standalone)

    # ── 정적 자산 (반드시 마지막: "/" 마운트가 다른 경로를 가리지 않도록) ──
    if os.path.isdir(SHARED_UI_DIR):
        app.mount("/shared/ui", NoCacheStaticFiles(directory=SHARED_UI_DIR), name="shared_ui")
    if standalone and manager.apps:
        only_app = next(iter(manager.apps.values()))
        static_dir = only_app.get_static_dir()
        if static_dir:
            app.mount("/", NoCacheStaticFiles(directory=static_dir, html=True), name="standalone_app")
    elif os.path.isdir(PORTAL_DIR):
        app.mount("/", NoCacheStaticFiles(directory=PORTAL_DIR, html=True), name="portal")
    return app


def _install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error(_: Request, exc: DomainError):
        return JSONResponse(exc.to_dict(), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        fields = [".".join(str(p) for p in e.get("loc", []) if p != "body") for e in exc.errors()]
        return JSONResponse({"success": False, "level": "error",
                             "message": "입력값 형식이 올바르지 않습니다.",
                             "hint": f"확인할 항목: {', '.join(f for f in fields if f) or '요청 본문'}",
                             "errors": exc.errors()}, status_code=422)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.exception("처리되지 않은 오류: %s %s", request.method, request.url.path)
        return JSONResponse({"success": False, "level": "error",
                             "message": "서버 내부 오류로 요청을 처리하지 못했습니다.",
                             "hint": "잠시 후 다시 시도하고, 반복되면 관리자에게 시각과 화면을 전달해 주세요.",
                             "reason": type(exc).__name__}, status_code=500)


def _install_middlewares(app: FastAPI, manager: SaaSAppManager) -> None:
    @app.middleware("http")
    async def actor_and_subdomain(request: Request, call_next):
        # 1) 서브도메인 → 앱 자동 분기 (앱 객체의 subdomains 메타데이터에서 생성)
        if request.url.path in ("", "/"):
            host = request.headers.get("host", "").split(":")[0].lower()
            target = manager.subdomain_map().get(host)
            if target:
                return RedirectResponse(f"/{target}/", status_code=307)

        # 2) 변경 이력에 남길 행위자(actor) 설정
        token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
        data = verify_token(token) if token else None
        reset = actor.set(data["u"] if data else "guest")
        try:
            response = await call_next(request)
        finally:
            actor.reset(reset)
        if request.url.path.startswith(("/api/", "/auth/")):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response
