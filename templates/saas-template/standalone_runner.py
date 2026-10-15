"""
standalone_runner.py
MQnet 범용 독립 솔루션(Standalone Mode) 단독 실행 진입점.
어떤 앱(rent, studycafe, store, selfstudy, mqfarm, ytdownloader, files 등)이든
FastAPI 백엔드 API 라우터들을 자동 감지하여 마운트하고, 정적 프론트엔드를 단일 프로세스로 호스팅합니다.
"""
import os
import sys
import logging
import importlib
import importlib.util
from typing import List, Tuple
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# 로깅 설정
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("standalone_runner")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

APP_ID = os.environ.get("APP_ID", "{{APP_ID}}")
APP_NAME = os.environ.get("APP_NAME", "{{APP_NAME}}")

app = FastAPI(
    title=f"{APP_NAME} (Standalone)",
    description=f"MQnet {APP_NAME} 독립 구동형 솔루션",
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

# ── 1. 공통 데이터베이스 자동 초기화 및 테이블 생성 ──
try:
    from shared.core.base_database import Base, get_database_service
    # 모델 임포트 시도 (Base.metadata 등록용)
    for model_mod_name in ["backend.db.models", f"apps.{APP_ID}.backend.db.models"]:
        try:
            importlib.import_module(model_mod_name)
            logger.info(f"✅ DB 모델 등록 완료: {model_mod_name}")
            break
        except Exception:
            pass

    db_service = get_database_service()
    if db_service.engine:
        Base.metadata.create_all(bind=db_service.engine)
        logger.info(f"✅ DB 스키마 검증/생성 완료: {db_service.database_url}")
except Exception as dbe:
    logger.warning(f"DB 초기화 알림: {dbe}")


# ── 2. 백엔드 API 라우터 범용 자동 탐색 & 등록 ──
mounted_routers: List[Tuple[str, any]] = []

def _try_collect_routers():
    # 방식 A: backend.routers 패키지 __all__ 또는 속성 탐색
    try:
        br_pkg = importlib.import_module("backend.routers")
        if hasattr(br_pkg, "__all__"):
            for attr_name in getattr(br_pkg, "__all__"):
                r = getattr(br_pkg, attr_name, None)
                if r and hasattr(r, "routes") and r not in [x[1] for x in mounted_routers]:
                    mounted_routers.append((attr_name, r))
    except Exception:
        pass

    # 방식 B: backend/routers 디렉토리 내 모든 .py 파일 스캔
    routers_dir = os.path.join(CURRENT_DIR, "backend", "routers")
    if os.path.exists(routers_dir):
        for fname in sorted(os.listdir(routers_dir)):
            if fname.endswith(".py") and not fname.startswith("__"):
                mod_name = fname[:-3]
                try:
                    m = importlib.import_module(f"backend.routers.{mod_name}")
                    r = getattr(m, "router", None)
                    if r and hasattr(r, "routes") and r not in [x[1] for x in mounted_routers]:
                        mounted_routers.append((mod_name, r))
                except Exception as me:
                    logger.warning(f"모듈 backend.routers.{mod_name} 탐색 중 알림: {me}")

    # 방식 C: backend.main_router 단일 모듈 직접 탐색
    if not mounted_routers:
        for direct_name in ["backend.routers.main_router", "backend.main_router"]:
            try:
                m = importlib.import_module(direct_name)
                r = getattr(m, "router", None)
                if r and hasattr(r, "routes"):
                    mounted_routers.append((direct_name, r))
                    break
            except Exception:
                pass

_try_collect_routers()

# 수집된 라우터들 일괄 마운트
for name, r in mounted_routers:
    route_count = len(getattr(r, "routes", []))
    # 1. /api/{app_id} 접두사
    if APP_ID and APP_ID != "{{APP_ID}}":
        app.include_router(r, prefix=f"/api/{APP_ID}")
    # 2. /api 접두사
    app.include_router(r, prefix="/api")
    # 3. 루트 호환
    app.include_router(r, prefix="")
    logger.info(f"✅ 라우터 마운트 완료: {name} ({route_count}개 엔드포인트)")

if not mounted_routers:
    logger.critical("🚨 활성화 가능한 백엔드 라우터를 찾지 못했습니다!")


# ── 3. 헬스체크 엔드포인트 ──
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "app_id": APP_ID,
        "app_name": APP_NAME,
        "mode": "standalone",
        "total_routers": len(mounted_routers),
        "version": "2.0.0"
    }


# ── 4. 프론트엔드 정적 파일 서빙 ──
frontend_dir = os.path.join(CURRENT_DIR, "frontend")
if not os.path.exists(frontend_dir) or not os.path.exists(os.path.join(frontend_dir, "index.html")):
    frontend_dir = CURRENT_DIR

if os.path.exists(os.path.join(frontend_dir, "index.html")):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    logger.info(f"✅ 프론트엔드 정적 자산 마운트: {frontend_dir}")
else:
    logger.warning("⚠️ 프론트엔드 index.html이 감지되지 않았습니다.")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"🚀 [{APP_NAME}] Standalone 서버 기동: http://{host}:{port}")
    uvicorn.run("standalone_runner:app", host=host, port=port, reload=False)
