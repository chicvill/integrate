"""
apps/photos/backend/main.py
Main entrypoint for Photos & Media Gallery Microservice following the Canonical SaaS Template.
"""
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
    title=settings.APP_NAME,
    description="스마트 사진 및 미디어 앨범 관리, 비전 AI 태깅 마이크로서비스",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Standardized router inclusions
app.include_router(gallery_router, prefix="/api/photos", tags=["미디어 & 사진 갤러리"])
app.include_router(ai_vision_router, prefix="/api/photos", tags=["사진 비전 AI"])

# Backward-compatibility routes for direct frontend calls
app.include_router(gallery_router, prefix="/api", include_in_schema=False)
app.include_router(ai_vision_router, prefix="/api", include_in_schema=False)


@app.get("/api/system-status", tags=["시스템 - 상태"])
@app.get("/api/photos/system-status", tags=["시스템 - 상태"])
def get_photos_system_status():
    return {
        "app_id": settings.APP_ID,
        "app_name": settings.APP_NAME,
        "deployment_mode": settings.DEPLOYMENT_MODE,
        "photos_dir": settings.PHOTOS_DIR,
        "cache_dir": settings.CACHE_DIR,
        "status": "HEALTHY",
        "features": settings.get_app_info()["features"]
    }


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
