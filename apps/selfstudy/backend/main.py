import os
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from deps import context, keepalive_loop
from routes.auth_routes import router as auth_router
from routes.onboarding_routes import router as onboarding_router
from routes.schedule_routes import router as schedule_router
from routes.attendance_routes import router as attendance_router
from routes.admin_routes import router as admin_router
from routes.message_routes import router as message_router
from routes.admin_settings_routes import router as admin_settings_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[INFO] Initializing App Context (and Knowledge Base)...")
    keepalive_task = asyncio.create_task(keepalive_loop())
    try:
        yield
    finally:
        keepalive_task.cancel()

app = FastAPI(
    title="SelfStudy Knowledge Base API",
    description="RAG 기반 비정형 목표 달성 및 스케줄러 SaaS",
    lifespan=lifespan
)

@app.get("/api/ping")
def ping():
    context.db_manager.ping_keepalive(1)
    return {"status": "ok", "keepalive": 1, "timestamp": datetime.now().isoformat()}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Router Modules
app.include_router(auth_router)
app.include_router(onboarding_router)
app.include_router(schedule_router)
app.include_router(attendance_router)
app.include_router(admin_router)
app.include_router(message_router)
app.include_router(admin_settings_router)

# ----------------- Static File Hosting & SPA Fallback -----------------
def get_dist_dir():
    possible_paths = [
        "/app/dist",
        "/app/backend/dist",
        "/dist",
        os.path.join(os.path.dirname(__file__), "dist"),
        os.path.join(os.path.dirname(__file__), "backend", "dist"),
        os.path.join(os.getcwd(), "dist"),
        os.path.join(os.getcwd(), "backend", "dist")
    ]
    for p in possible_paths:
        if p and os.path.exists(p) and os.path.isdir(p):
            return p
    return None

dist_dir = get_dist_dir()
if dist_dir:
    print(f"[STATIC] Serving frontend static files from: {dist_dir}")
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("knowledge") or full_path.startswith("api"):
            return None
        target = os.path.join(dist_dir, full_path)
        if os.path.exists(target) and os.path.isfile(target):
            return FileResponse(target)
        index_file = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"error": "Frontend build not found"}
else:
    print("[STATIC WARNING] Could not find dist directory for static file serving.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
