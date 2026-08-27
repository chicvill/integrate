import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.config import settings
from backend.db.database import engine, Base
from backend.routers import auth, seats, tickets, nfc_door

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Auto-create DB tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=f"MQnet StudyCafe Unified System [{settings.DEPLOYMENT_MODE}]",
    description="STcafe + MQcafe Unified Core with SelfStudy AI Side Module",
    version="1.0.0"
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
app.include_router(auth.router)
app.include_router(seats.router)
app.include_router(tickets.router)

if settings.ENABLE_NFC_DOOR:
    app.include_router(nfc_door.router)


@app.get("/api/system-status")
def get_system_status():
    return {
        "deployment_mode": settings.DEPLOYMENT_MODE,
        "is_standalone": settings.is_standalone,
        "enable_nfc_door": settings.ENABLE_NFC_DOOR,
        "database": settings.DATABASE_URL.split(":///")[0],
        "status": "HEALTHY"
    }

# Mount React Frontend static build if available
dist_dir = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "API route not found"})
        return FileResponse(os.path.join(dist_dir, "index.html"))
