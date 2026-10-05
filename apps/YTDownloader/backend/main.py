import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from apps.YTDownloader.backend.config import settings
from apps.YTDownloader.backend.db.database import engine, Base
from apps.YTDownloader.backend.routers import download, media

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ytdownloader_main")

# Auto-create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=f"MQnet YTDownloader SaaS Platform [{settings.DEPLOYMENT_MODE}]",
    description="YTDownloader Unified SaaS Engine",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(download.router)
app.include_router(media.router)

@app.get("/api/system-status")
def get_system_status():
    return {
        "deployment_mode": settings.DEPLOYMENT_MODE,
        "is_standalone": settings.is_standalone,
        "enable_ai_transcription": settings.ENABLE_AI_TRANSCRIPTION,
        "enable_offline_sync": settings.ENABLE_OFFLINE_SYNC,
        "database": settings.DATABASE_URL.split(":///")[0],
        "downloads_count": len(os.listdir(settings.DOWNLOADS_DIR)) if os.path.exists(settings.DOWNLOADS_DIR) else 0,
        "status": "HEALTHY"
    }

# Mount React Frontend static build if available
dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "API route not found"})
        return FileResponse(os.path.join(dist_dir, "index.html"))
