"""
shared/core/base_app.py
모든 앱의 FastAPI 앱 인스턴스를 공통으로 생성하는 스마트 팩토리 함수.
CORS, 헬스체크, 표준 예외 핸들러, 요청 로깅, 앱 컨텍스트 미들웨어를 자동 등록합니다.

사용 예시:
    from shared.core.base_app import create_base_app
    from .config import StudyCafeConfig

    settings = StudyCafeConfig()
    app = create_base_app(settings)
    app.include_router(studycafe_router)
"""
import time
import logging
from contextlib import asynccontextmanager
from typing import Optional, Callable, List

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from shared.core.base_config import BaseConfig
from shared.core.base_database import init_database
from shared.core.exceptions import AppException

logger = logging.getLogger("mqnet.base_app")


def create_base_app(
    settings: BaseConfig,
    include_auth: bool = True,
    lifespan: Optional[Callable] = None,
    extra_routers: Optional[List] = None,
    include_root_route: bool = True,
) -> FastAPI:
    """
    스마트 공통 FastAPI 앱 팩토리 함수.

    Args:
        settings: 앱별 설정 객체 (BaseConfig를 상속한 클래스)
        include_auth: 공통 인증 라우터 포함 여부 (기본: True)
        lifespan: 커스텀 FastAPI 라이프스팬 컨텍스트 매니저 (선택)
        extra_routers: 자동 등록할 추가 라우터 목록 (선택)

    Returns:
        FastAPI 앱 인스턴스 (CORS, 헬스체크, 로깅, 예외 핸들러 포함)
    """

    @asynccontextmanager
    async def default_lifespan(app_instance: FastAPI):
        # ─── 앱 시작 (Startup) ───────────────────────────
        logger.info(f"[{settings.APP_ID}] 앱을 시작합니다. 모드: {settings.DEPLOYMENT_MODE}")
        try:
            db = init_database(settings.DATABASE_URL)
            db.create_tables()
            logger.info(f"[{settings.APP_ID}] DB 연결 및 테이블 초기화 완료")
        except Exception as e:
            logger.warning(f"[{settings.APP_ID}] DB 자동 초기화 중 경고 (계속 진행): {e}")

        if lifespan:
            async with lifespan(app_instance):
                yield
        else:
            yield

        # ─── 앱 종료 (Shutdown) ───────────────────────────
        logger.info(f"[{settings.APP_ID}] 앱을 종료합니다.")

    app = FastAPI(
        title=settings.APP_NAME,
        description=f"MQnet {settings.APP_NAME} - Powered by MQnet Integrated Platform",
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=default_lifespan,
    )

    # 공통 인증 라우터 등록 (FastAPI 초기화 시점에 안전하게 마운트)
    if include_auth:
        try:
            from shared.auth.router import auth_router
            app.include_router(auth_router, prefix="/auth", tags=["인증 (공통)"])
            logger.info(f"[{settings.APP_ID}] 공통 인증 라우터 등록 완료")
        except Exception as e:
            logger.warning(f"[{settings.APP_ID}] 인증 라우터 등록 생략: {e}")

    # ─── CORS 미들웨어 ────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=getattr(settings, "CORS_ORIGINS", ["*"]) or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ─── 요청 로깅 & 실행시간 측정 미들웨어 ──────────────
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        elapsed = (time.time() - start) * 1000
        # 헬스체크 등 잦은 폴링은 DEBUG 레벨로 완화
        if request.url.path == "/health":
            logger.debug(f"[{settings.APP_ID}] {request.method} {request.url.path} - {response.status_code} ({elapsed:.1f}ms)")
        else:
            logger.info(
                f"[{settings.APP_ID}] {request.method} {request.url.path} "
                f"- {response.status_code} ({elapsed:.1f}ms)"
            )
        return response

    # ─── App-ID 컨텍스트 미들웨어 ────────────────────────
    @app.middleware("http")
    async def inject_app_context(request: Request, call_next):
        request.state.app_id = settings.APP_ID
        request.state.app_settings = settings
        return await call_next(request)

    # ─── 공통 엔드포인트 ─────────────────────────────────
    @app.get("/health", tags=["System"])
    async def health_check():
        """서버 상태 확인 엔드포인트 (모든 앱 공통)"""
        return {
            "status": "healthy",
            **settings.get_app_info()
        }

    if include_root_route:
        @app.get("/", tags=["System"])
        async def root():
            """루트 엔드포인트"""
            return {
                "message": f"{settings.APP_NAME}에 오신 것을 환영합니다.",
                "app_id": settings.APP_ID,
                "version": settings.APP_VERSION,
                "docs": "/docs",
            }

    # ─── 표준 비즈니스 예외 핸들러 ──────────────────────
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.warning(f"[{settings.APP_ID}] Business Exception ({exc.error_code}): {exc.message}")
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    # ─── 404 및 500 에러 핸들러 ───────────────────────────
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": "요청한 리소스를 찾을 수 없습니다.",
                "error_code": "NOT_FOUND",
                "path": str(request.url.path),
            },
        )

    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc):
        logger.error(f"[{settings.APP_ID}] Internal Server Error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
                "error_code": "INTERNAL_SERVER_ERROR",
            },
        )

    # 추가 라우터 일괄 등록 (전달된 경우)
    if extra_routers:
        for r in extra_routers:
            app.include_router(r)

    return app


def mount_static_directory(app: FastAPI, path: str, directory: str, html: bool = True, name: Optional[str] = None):
    """
    디렉토리가 존재하는 경우에만 안전하게 정적 파일을 마운트하는 헬퍼.
    """
    import os
    from fastapi.staticfiles import StaticFiles

    abs_dir = os.path.abspath(directory)
    if os.path.exists(abs_dir):
        mount_name = name or f"static_{path.strip('/').replace('/', '_')}"
        app.mount(path, StaticFiles(directory=abs_dir, html=html), name=mount_name)
        logger.info(f"정적 파일 마운트 완료: {path} -> {abs_dir}")
        return True
    return False
