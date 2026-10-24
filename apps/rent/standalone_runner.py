"""
apps/rent/standalone_runner.py
부동산 원룸 임차료 관리 시스템 (Rent App) 단독 실행 진입점.
FastAPI 백엔드와 프론트엔드 정적 자산을 단일 프로세스로 호스팅합니다.
"""
import os
import sys
import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("rent_standalone")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
for p in [CURRENT_DIR, PROJECT_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from apps.rent.backend.routers.main_router import router as rent_router
except ImportError:
    from backend.routers.main_router import router as rent_router

app = FastAPI(
    title="부동산 원룸 임차료 관리 시스템 (Standalone)",
    description="MQnet 원룸 임대관리 독립 솔루션",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "rent", "mode": "standalone"}

# 백엔드 API 라우터 마운트
app.include_router(rent_router, prefix="/api/rent")
app.include_router(rent_router, prefix="/api")

# 프론트엔드 정적 파일 서빙
frontend_dir = os.path.join(CURRENT_DIR, "frontend")
if not os.path.exists(frontend_dir):
    frontend_dir = CURRENT_DIR

if os.path.exists(os.path.join(frontend_dir, "index.html")):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    logger.info(f"프론트엔드 마운트 완료: {frontend_dir}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"🚀 원룸 임대관리 솔루션 기동: http://{host}:{port}")
    uvicorn.run("standalone_runner:app", host=host, port=port, reload=False)
