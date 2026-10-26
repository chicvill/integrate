import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from apps.studycafe.backend.config import settings
from shared.core.base_database import Base, get_database_service
from apps.studycafe.backend.routers import (
    seat_router, ticket_router, session_router,
    door_router, ai_router, studycafe_selfstudy_router, study_auth_router, branch_router
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("studycafe.main")

# Auto-create DB tables on startup
db_service = get_database_service()
Base.metadata.create_all(bind=db_service.engine)

app = FastAPI(
    title=f"MQnet StudyCafe Unified System [{settings.DEPLOYMENT_MODE}]",
    description="STcafe + MQcafe Unified Core with SelfStudy AI Side Module",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Core Routers
app.include_router(study_auth_router, prefix="/api/auth", tags=["스터디카페 - 인증"])
app.include_router(branch_router, prefix="/api/branches", tags=["스터디카페 - 지점"])
app.include_router(seat_router, prefix="/api/seats", tags=["스터디카페 - 좌석"])
app.include_router(ticket_router, prefix="/api/tickets", tags=["스터디카페 - 이용권"])
app.include_router(door_router, prefix="/api/door", tags=["스터디카페 - 출입문"])
app.include_router(session_router, prefix="/api/sessions", tags=["스터디카페 - 세션"])
app.include_router(ai_router, prefix="/api/ai", tags=["스터디카페 - AI"])
app.include_router(studycafe_selfstudy_router, tags=["스터디카페 - 자기주도학습"])


@app.get("/api/system-status")
def get_system_status():
    return {
        "deployment_mode": settings.DEPLOYMENT_MODE,
        "is_standalone": settings.is_standalone,
        "enable_nfc_door": settings.ENABLE_NFC_DOOR,
        "database": settings.DATABASE_URL.split(":///")[0],
        "status": "HEALTHY",
        "version": "2.0.0"
    }

# Mount Vanilla JS Frontend static assets
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/assets", StaticFiles(directory=frontend_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "API route not found"})
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
