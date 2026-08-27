"""
shared/core/base_app.py
모든 앱의 FastAPI 앱 인스턴스를 공통으로 생성하는 팩토리 함수.
CORS, 헬스체크, 미들웨어, 앱 컨텍스트 미들웨어를 자동 등록합니다.

사용 예시:
    from shared.core.base_app import create_base_app
    from .config import StudyCafeConfig

    settings = StudyCafeConfig()
    app = create_base_app(settings)
    app.include_router(studycafe_router)
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from shared.core.base_config import BaseConfig
from shared.core.base_database import init_database, Base
import logging
import time

logger = logging.getLogger("mqnet.base_app")


def create_base_app(settings: BaseConfig, include_auth: bool = True) -> FastAPI:
    """
    공통 FastAPI 앱 팩토리 함수.
    
    Args:
        settings: 앱별 설정 객체 (BaseConfig를 상속한 클래스)
        include_auth: 공통 인증 라우터 포함 여부 (기본: True)
    
    Returns:
        FastAPI 앱 인스턴스 (CORS, 헬스체크, 로깅 미들웨어 포함)
    """
    app = FastAPI(
        title=settings.APP_NAME,
        description=f"MQnet {settings.APP_NAME} - Powered by MQnet Integrated Platform",
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ─── CORS 미들웨어 ────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ─── 요청 로깅 미들웨어 ──────────────────────────────
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        elapsed = (time.time() - start) * 1000
        logger.info(
            f"[{settings.APP_ID}] {request.method} {request.url.path} "
            f"- {response.status_code} ({elapsed:.1f}ms)"
        )
        return response

    # ─── App-ID 컨텍스트 미들웨어 ────────────────────────
    @app.middleware("http")
    async def inject_app_context(request: Request, call_next):
        # 요청 state에 app_id 주입 (라우터 핸들러에서 request.state.app_id로 참조)
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

    @app.get("/", tags=["System"])
    async def root():
        """루트 엔드포인트"""
        return {
            "message": f"{settings.APP_NAME}에 오신 것을 환영합니다.",
            "app_id": settings.APP_ID,
            "docs": "/docs",
        }

    # ─── 공통 에러 핸들러 ────────────────────────────────
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(
            status_code=404,
            content={"error": "요청한 리소스를 찾을 수 없습니다.", "path": str(request.url.path)}
        )

    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc):
        logger.error(f"Internal Server Error: {exc}")
        return JSONResponse(
            status_code=500,
            content={"error": "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}
        )

    # ─── DB 초기화 이벤트 ─────────────────────────────────
    @app.on_event("startup")
    async def startup_event():
        logger.info(f"[{settings.APP_ID}] 앱을 시작합니다. 모드: {settings.DEPLOYMENT_MODE}")
        db = init_database(settings.DATABASE_URL)
        db.create_tables()
        logger.info(f"[{settings.APP_ID}] DB 연결 완료: {settings.DATABASE_URL[:30]}...")

        # 공통 인증 라우터 등록
        if include_auth:
            from shared.auth.router import auth_router
            app.include_router(auth_router, prefix="/auth", tags=["인증 (공통)"])
            logger.info(f"[{settings.APP_ID}] 공통 인증 라우터 등록 완료")

    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info(f"[{settings.APP_ID}] 앱을 종료합니다.")

    return app
