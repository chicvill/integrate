"""
templates/saas-template/backend/main.py
단독 로컬 실행 및 게이트웨이 연동용 FastAPI 진입점.
"""
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from shared.core.base_database import Base, get_database_service
from .config import settings
from .routers.main_router import router as main_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("{{APP_ID}}_main")

# 데이터베이스 테이블 자동 생성
try:
    db_service = get_database_service()
    Base.metadata.create_all(bind=db_service.engine)
except Exception as e:
    logger.warning(f"DB 초기화 경고: {e}")

app = FastAPI(
    title=f"MQnet {settings.APP_NAME} SaaS Service",
    description=f"{settings.APP_NAME} 독립 SaaS API 마이크로서비스",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 미들웨어
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 핵심 라우터 마운트
app.include_router(main_router, prefix="/api")

# 단독 실행 시 프론트엔드 정적 서빙
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend_app")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
