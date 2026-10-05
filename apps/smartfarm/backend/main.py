import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.config import settings
from backend.db.database import engine, Base
from backend.routers import sensors, actuators, growth

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smartfarm_main")

# Auto-create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=f"MQnet SmartFarm Unified Platform [{settings.DEPLOYMENT_MODE}]",
    description="MQfarm Unified Core (SaaS & Standalone Mode)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensors.router)
app.include_router(actuators.router)
app.include_router(growth.router)

@app.get("/api/system-status")
def get_system_status():
    return {
        "deployment_mode": settings.DEPLOYMENT_MODE,
        "is_standalone": settings.is_standalone,
        "enable_growth_ai": settings.ENABLE_GROWTH_AI,
        "enable_offline_sync": settings.ENABLE_OFFLINE_SYNC,
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
