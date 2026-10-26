"""apps/ai_gwansang/backend/main.py - AI 관상 앱 진입점"""
import logging
from pathlib import Path

from shared.core.base_app import create_base_app
from shared.auth.router import auth_router
from .config import get_settings
from .routers.analysis_router import router as analysis_router

logging.basicConfig(level=logging.INFO)
settings = get_settings()

# 빌드된 프론트엔드(Vite) 정적 파일 경로: apps/ai_gwansang/frontend/dist
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

app = create_base_app(settings, include_auth=False, include_root_route=False)
app.include_router(auth_router, prefix="/auth", tags=["인증 (공통)"])
app.include_router(analysis_router, prefix="/analysis", tags=["AI 관상 분석"])

import os
from fastapi.staticfiles import StaticFiles

if FRONTEND_DIST.exists():
    # Mount the frontend distribution at the root
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.ai_gwansang.backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)