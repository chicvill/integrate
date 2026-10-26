"""
apps/grammer/backend/main.py
Stand-alone entrypoint for Grammar Quest using shared.core.create_base_app.
"""
import os
from fastapi.staticfiles import StaticFiles
from shared.core.base_app import create_base_app
from apps.grammer.backend.config import settings
from apps.grammer.backend.routers.grammer_router import router as grammer_router

app = create_base_app(settings)

# API 라우터 등록
app.include_router(grammer_router, prefix="/api", tags=["Grammar Quest API"])

# 프론트엔드 정적 파일 서빙
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if os.path.exists(os.path.join(frontend_dir, "index.html")):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="grammer_frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
