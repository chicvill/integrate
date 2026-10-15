"""
standalone_runner.py
단독 배포 환경(Standalone Mode) 전용 통합 진입점.
FastAPI 백엔드 API와 정적 프론트엔드를 단일 프로세스에서 호스팅합니다.
"""
import os
import sys
import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# 로깅 설정
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("standalone_runner")

# 현재 경로를 sys.path에 등록
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# 1. 백엔드 라우터 및 설정 로드
main_router = None
try:
    from backend.routers.main_router import router as main_router
    logger.info("✅ 백엔드 라우터 임포트 성공: backend.routers.main_router")
except Exception as e:
    logger.error(f"⚠️ 백엔드 직접 임포트 실패, fallback 시도: {e}")
    try:
        import importlib
        app_id_env = os.environ.get("APP_ID", "{{APP_ID}}")
        if app_id_env and app_id_env != "{{APP_ID}}":
            mod = importlib.import_module(f"apps.{app_id_env}.backend.routers.main_router")
            main_router = getattr(mod, "router", None)
            logger.info(f"✅ 백엔드 fallback 임포트 성공: apps.{app_id_env}")
    except Exception as e2:
        logger.error(f"❌ 백엔드 fallback 임포트도 실패: {e2}")
        import traceback
        traceback.print_exc()

app = FastAPI(
    title="{{APP_NAME}} (Standalone)",
    description="MQnet 독립 솔루션 패키지",
    version="2.0.0"
)

# CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 헬스체크 엔드포인트
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "app": "{{APP_ID}}",
        "mode": "standalone",
        "version": "2.0.0",
        "router_loaded": main_router is not None
    }

# 백엔드 API 라우터 마운트 (/api 및 /api/{{APP_ID}} 동시 지원)
if main_router:
    app.include_router(main_router, prefix="/api")
    if "{{APP_ID}}" != "base":
        app.include_router(main_router, prefix="/api/{{APP_ID}}")
    logger.info("✅ 백엔드 API 라우터 마운트 완료 (/api, /api/{{APP_ID}})")
else:
    logger.critical("🚨 백엔드 라우터가 등록되지 않았습니다! API 요청이 404/405 처리될 수 있습니다.")

# 프론트엔드 정적 파일 서빙
frontend_dir = os.path.join(CURRENT_DIR, "frontend")
if not os.path.exists(frontend_dir):
    frontend_dir = CURRENT_DIR

if os.path.exists(os.path.join(frontend_dir, "index.html")):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    logger.info(f"프론트엔드 정적 디렉토리 마운트 완료: {frontend_dir}")
else:
    logger.warning("프론트엔드 index.html을 찾을 수 없습니다.")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"🚀 Standalone 솔루션 가동 중: http://{host}:{port}")
    uvicorn.run("standalone_runner:app", host=host, port=port, reload=False)
