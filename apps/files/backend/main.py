"""
apps/files/backend/main.py
Standalone FastAPI entrypoint for MQnet Files Hub.
Run locally:
    python -m uvicorn apps.files.backend.main:app --host 0.0.0.0 --port 8011 --reload
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from apps.files.backend.config import settings
from apps.files.backend.routers.files_router import router as files_router

app = FastAPI(
    title=settings.APP_NAME,
    description="MQnet 통합 파일 스토리지 허브 - 독립 실행 및 게이트웨이 호환 API",
    version=settings.APP_VERSION,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 백엔드 API 라우터 마운트
app.include_router(files_router, prefix="/api", tags=["Files Hub API"])

# 프론트엔드 정적 서빙 (독립 실행 시)
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.files.backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
