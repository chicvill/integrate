"""
apps/photos/backend/main.py
Main entrypoint for Photos & Media Gallery Microservice.
"""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from apps.photos.backend.config import settings
from apps.photos.backend.routers import gallery_router, ai_vision_router
from shared.core.base_database import Base, init_database
import apps.photos.backend.db.models

# Initialize DB tables
db_service = init_database()
Base.metadata.create_all(bind=db_service.engine)

app = FastAPI(
    title="MQnet Photos & Media Gallery",
    description="스마트 사진 및 미디어 앨범 관리, 비전 AI 태깅 마이크로서비스",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Include API Routers
app.include_router(gallery_router, prefix="/api")
app.include_router(ai_vision_router, prefix="/api")

# Static frontend mount
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    class NoCacheStaticFiles(StaticFiles):
        async def get_response(self, path: str, scope):
            response = await super().get_response(path, scope)
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            return response

    app.mount("/", NoCacheStaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.photos.backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
