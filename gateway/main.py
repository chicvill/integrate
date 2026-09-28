"""
gateway/main.py
모든 SaaS 앱을 단일 포트에서 서비스하는 통합 API 게이트웨이 및 웹 포털.
"""
import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles


from shared.auth.router import auth_router
from shared.tenant.registry import list_apps, get_app_config
from shared.tenant.middleware import app_context_middleware

# 각 앱 라우터 임포트
from apps.studycafe.backend.routers import seat_router, ticket_router, session_router
from apps.studycafe.backend.routers.door_router import router as study_door_router
from apps.studycafe.backend.routers.ai_router import router as study_ai_tutor_router
from apps.studycafe.backend.routers.auth import router as study_auth_router

from apps.store.backend.routers import (
    order_router,
    menu_router,
    table_router,
    inventory_router as store_inventory_router,
    situation_router as store_situation_router,
    staff_router as store_staff_router,
)
from apps.selfstudy.backend.routers import (
    plan_router,
    progress_router,
    ai_router as study_ai_router,
    onboarding_router as study_onboarding_router,
    schedule_router as study_schedule_router,
    attendance_router as study_attendance_router,
    admin_router as study_admin_router,
)
from apps.mqfarm.backend.routers import (
    sensor_router as farm_sensor_router,
    actuator_router as farm_actuator_router,
    growth_router as farm_growth_router
)

from apps.ai_gwansang.backend.routers.analysis_router import router as gwansang_router
from apps.photos.backend.routers import (
    gallery_router as photos_gallery_router,
    ai_vision_router as photos_ai_router
)
from apps.YTDownloader.backend.routers import (
    download_router as yt_download_router,
    media_router as yt_media_router
)
from apps.face_analy.backend.routers import face_analy_router
from apps.videoBooth.backend.routers import videobooth_router
from apps.grammer.backend.routers.grammer_router import router as grammer_router




logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mqnet.gateway")

app = FastAPI(
    title="MQnet 통합 SaaS 플랫폼 Gateway",
    description=(
        "MQnet 멀티 SaaS 통합 플랫폼 API 게이트웨이.\n\n"
        "**공통 인증**: 모든 앱은 X-App-ID 헤더와 함께 /auth 엔드포인트를 사용합니다.\n\n"
        "**앱별 API**: /api/{app_id}/ 프리픽스로 각 앱 전용 API에 접근합니다."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 성능 최적화: 정적 자산 브라우저 캐싱 & 동적 API 노캐시 미들웨어
@app.middleware("http")
async def add_performance_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.endswith((".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".webp")):
        response.headers["Cache-Control"] = "public, max-age=3600"
    elif path.startswith("/api/") or path.startswith("/auth/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response
 
# 서브도메인 기반 자동 라우팅 미들웨어 ({app}.chicvill.store -> 각 앱 메인 경로)
@app.middleware("http")
async def subdomain_host_router_middleware(request: Request, call_next):
    host = request.headers.get("host", "").lower().split(":")[0]
    path = request.url.path
    if path in ("/", ""):
        subdomain_routes = {
            "home.chicvill.store": "/mqhome/",
            "studycafe.chicvill.store": "/studycafe/",
            "study.chicvill.store": "/studycafe/",
            "selfstudy.chicvill.store": "/selfstudy/",
            "store.chicvill.store": "/store/",
            "smartfarm.chicvill.store": "/mqfarm/",
            "mqfarm.chicvill.store": "/mqfarm/",
            "gwansang.chicvill.store": "/gwansang/",
            "face.chicvill.store": "/face_analy/",
            "ironman.chicvill.store": "/ironman/",
            "clock.chicvill.store": "/clock/",
            "video.chicvill.store": "/videobooth/",
            "grammar.chicvill.store": "/grammar/",
            "grammer.chicvill.store": "/grammar/",
        }
        if host in subdomain_routes:
            return RedirectResponse(url=subdomain_routes[host], status_code=307)
    return await call_next(request)

# 미들웨어
app.middleware("http")(app_context_middleware)

# 공통 인증 라우터
app.include_router(auth_router, prefix="/auth", tags=["공통 인증 (X-App-ID 필수)"])

# 1. 스터디카페 앱
app.include_router(seat_router, prefix="/api/studycafe/seats", tags=["스터디카페 - 좌석"])
app.include_router(study_door_router, prefix="/api/studycafe/door", tags=["스터디카페 - 스마트 도어락"])
app.include_router(study_ai_tutor_router, prefix="/api/studycafe/ai", tags=["스터디카페 - AI 학습 튜터"])
app.include_router(ticket_router, prefix="/api/studycafe/tickets", tags=["스터디카페 - 이용권"])
app.include_router(session_router, prefix="/api/studycafe/sessions", tags=["스터디카페 - 세션"])

# 2. 매장 QR 주문 & POS 관제 (MQnet Store) 앱
app.include_router(table_router, prefix="/api/store/tables", tags=["매장 - 테이블"])
app.include_router(menu_router, prefix="/api/store/menu", tags=["매장 - 메뉴"])
app.include_router(order_router, prefix="/api/store/orders", tags=["매장 - 주문 및 POS"])
app.include_router(store_inventory_router, prefix="/api/store/inventory", tags=["매장 - 상품 및 재고"])
app.include_router(store_situation_router, prefix="/api/store/situation", tags=["매장 - 실시간 상황실 AI 관제"])
app.include_router(store_staff_router, prefix="/api/store/staff", tags=["매장 - 직원/점장/점주 관제"])


# 3. 자기주도학습 (MQstudy) 앱
app.include_router(plan_router, prefix="/api/selfstudy/plans", tags=["자기주도학습 - 계획"])
app.include_router(progress_router, prefix="/api/selfstudy/progress", tags=["자기주도학습 - 진도"])
app.include_router(study_ai_router, prefix="/api/selfstudy/ai", tags=["자기주도학습 - AI 멘토"])
app.include_router(study_onboarding_router, prefix="/api/selfstudy/onboarding", tags=["자기주도학습 - 온보딩 스케줄러"])
app.include_router(study_schedule_router, prefix="/api/selfstudy/schedule", tags=["자기주도학습 - 진도체크 & AI 평가"])
app.include_router(study_attendance_router, prefix="/api/selfstudy/attendance", tags=["자기주도학습 - 출결 & 학부모 참관"])
app.include_router(study_admin_router, prefix="/api/selfstudy/admin", tags=["자기주도학습 - 관리자 & 대면 상담"])

# 4. MQFarm 앱
app.include_router(farm_sensor_router, prefix="/api/mqfarm/sensors", tags=["MQFarm - 센서"])
app.include_router(farm_actuator_router, prefix="/api/mqfarm/controls", tags=["MQFarm - 제어"])
app.include_router(farm_growth_router, prefix="/api/mqfarm/growth", tags=["MQFarm - 작물생육 AI"])

# 5. AI 관상 앱
app.include_router(gwansang_router, prefix="/api/ai_gwansang", tags=["AI 관상 분석"])

# 6. 사진 & 미디어 갤러리 앱
app.include_router(photos_gallery_router, prefix="/api/photos", tags=["미디어 & 사진 갤러리"])
app.include_router(photos_ai_router, prefix="/api/photos", tags=["사진 비전 AI"])

# 7. 유튜브 미디어 다운로더 (YTDownloader)
app.include_router(yt_download_router, prefix="/api/ytdownloader", tags=["유튜브 다운로더"])
app.include_router(yt_media_router, prefix="/api/ytdownloader/media", tags=["유튜브 미디어"])

# 8. 테토/에겐 AI 얼굴 분석 (face_analy)
app.include_router(face_analy_router, prefix="/api/face_analy", tags=["테토/에겐 얼굴 분석"])

# 9. 레트로 TV 비디오 부스 (videoBooth)
app.include_router(videobooth_router, prefix="/api/videobooth", tags=["비디오 부스"])
app.include_router(videobooth_router, prefix="/videobooth", include_in_schema=False)

# 10. AI 영문법 퀘스트 (Grammar Quest)
app.include_router(grammer_router, prefix="/api/grammer", tags=["AI 영문법 퀘스트"])

# ── 원본 앱 API 호환 라우팅 ──
app.include_router(seat_router, prefix="/api/seats", include_in_schema=False)
app.include_router(study_auth_router, prefix="/api/auth", include_in_schema=False)
app.include_router(ticket_router, prefix="/api/tickets", include_in_schema=False)
app.include_router(session_router, prefix="/api/sessions", include_in_schema=False)
app.include_router(store_inventory_router, include_in_schema=False)
app.include_router(order_router, include_in_schema=False)
app.include_router(store_situation_router, include_in_schema=False)
app.include_router(farm_sensor_router, prefix="/api/sensors", include_in_schema=False)
app.include_router(farm_actuator_router, prefix="/api/actuators", include_in_schema=False)
app.include_router(farm_growth_router, prefix="/api/growth", include_in_schema=False)

@app.get("/api/system-status", tags=["시스템 - 상태"])
def get_system_status():
    from apps.store.backend.config import settings
    return {
        "deployment_mode": "SAAS_PORTAL",
        "is_standalone": False,
        "enable_ai_analytics": True,
        "enable_offline_sync": True,
        "status": "HEALTHY"
    }
app.include_router(photos_gallery_router, prefix="/api", include_in_schema=False)
app.include_router(yt_download_router, prefix="/api/download", include_in_schema=False)
app.include_router(yt_media_router, prefix="/api/media", include_in_schema=False)


@app.get("/api/system-status", tags=["시스템 상태 (호환)"])
def get_system_status_compat():
    from apps.store.backend.config import settings
    return {
        "status": "OPERATIONAL",
        "deployment_mode": getattr(settings, "DEPLOYMENT_MODE", "LOCAL_STANDALONE"),
        "enable_ai_analytics": getattr(settings, "ENABLE_AI_ANALYTICS", True),
        "enable_offline_sync": getattr(settings, "ENABLE_OFFLINE_SYNC", False),
        "database": "SQLite (N100 Local)" if "sqlite" in getattr(settings, "DATABASE_URL", "sqlite") else "Supabase PostgreSQL (Cloud)"
    }


# ── 오리지널 웹앱 빌드 정적 서빙 ──
studycafe_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "studycafe", "frontend", "dist"))
if os.path.exists(studycafe_dist):
    app.mount("/studycafe", StaticFiles(directory=studycafe_dist, html=True), name="studycafe_react_app")

store_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "store", "frontend", "dist"))
if os.path.exists(store_dist):
    app.mount("/store", StaticFiles(directory=store_dist, html=True), name="store_react_app")

selfstudy_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "selfstudy", "frontend", "dist"))
if os.path.exists(selfstudy_dist):
    app.mount("/selfstudy", StaticFiles(directory=selfstudy_dist, html=True), name="selfstudy_react_app")

mqfarm_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "mqfarm", "frontend", "dist"))
if os.path.exists(mqfarm_dist):
    app.mount("/mqfarm", StaticFiles(directory=mqfarm_dist, html=True), name="mqfarm_react_app")

photos_frontend = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "photos", "frontend"))
if os.path.exists(photos_frontend):
    app.mount("/photos", StaticFiles(directory=photos_frontend, html=True), name="photos_app")

gwansang_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "ai_gwansang", "frontend", "dist"))
if not os.path.exists(gwansang_dist):
    gwansang_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "ai_gwansang", "dist"))
if not os.path.exists(gwansang_dist):
    gwansang_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "ai-gwansang-saas", "dist"))
if os.path.exists(gwansang_dist):
    app.mount("/gwansang", StaticFiles(directory=gwansang_dist, html=True), name="gwansang_react_app")
    app.mount("/ai_gwansang", StaticFiles(directory=gwansang_dist, html=True), name="ai_gwansang_app")

# ── 유튜브 미디어 다운로더: 독립 도메인(youtube.chicvill.store) 301 리다이렉트 ──
from fastapi.responses import RedirectResponse
@app.get("/ytdownloader", include_in_schema=False)
def redirect_ytdownloader_root():
    return RedirectResponse(url="https://youtube.chicvill.store/", status_code=301)

@app.get("/ytdownloader/{full_path:path}", include_in_schema=False)
def redirect_ytdownloader_path(full_path: str):
    return RedirectResponse(url=f"https://youtube.chicvill.store/{full_path}", status_code=301)

mqhome_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "MQhome"))
if os.path.exists(mqhome_dir):
    app.mount("/mqhome", StaticFiles(directory=mqhome_dir, html=True), name="mqhome_portal")

ironman_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "260731_iron man game"))
if os.path.exists(ironman_dir):
    app.mount("/ironman", StaticFiles(directory=ironman_dir, html=True), name="ironman_game")
    app.mount("/260731_iron man game", StaticFiles(directory=ironman_dir, html=True), name="ironman_game_raw")

clock_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "Clock", "web"))
if os.path.exists(clock_dir):
    app.mount("/clock", StaticFiles(directory=clock_dir, html=True), name="modern_clock")

face_analy_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "face_analy", "dist"))
if os.path.exists(face_analy_dist):
    app.mount("/face_analy", StaticFiles(directory=face_analy_dist, html=True), name="face_analy_app")

videobooth_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "videoBooth"))
if os.path.exists(videobooth_dir):
    app.mount("/videobooth", StaticFiles(directory=videobooth_dir, html=True), name="videobooth_app")

grammer_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "grammer"))
if os.path.exists(grammer_dir):
    app.mount("/grammar", StaticFiles(directory=grammer_dir, html=True), name="grammar_app")
    app.mount("/grammer", StaticFiles(directory=grammer_dir, html=True), name="grammer_app")








# ─── 메인 웹 대시보드 포털 (GET /) ──────────────────────
@app.get("/", response_class=HTMLResponse, tags=["플랫폼 포털"])
async def platform_home(request: Request):
    portal_path = os.path.join(os.path.dirname(__file__), "portal.html")
    if os.path.exists(portal_path):
        with open(portal_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return JSONResponse(content={
        "platform": "MQnet 통합 SaaS 플랫폼",
        "version": "1.0.0",
        "docs": "/docs",
        "apps_list": "/apps",
        "health": "/health",
    })


@app.get("/apps", tags=["플랫폼"])
async def list_registered_apps():
    """등록된 모든 SaaS 앱의 아이콘 및 한글 설명 목록"""
    return {
        "platform": "MQnet 통합 SaaS 플랫폼",
        "total_apps": len(list_apps()),
        "apps": list_apps()
    }


@app.get("/api/health/all", tags=["플랫폼"])
async def check_all_services_health():
    """16대 마이크로서비스 실시간 가동 상태 및 시스템 리소스 헬스체크 (표준 라이브러리 기반)"""
    import urllib.request
    import urllib.error
    import shutil
    import asyncio

    host_ip = "host.docker.internal" if os.path.exists("/.dockerenv") else "127.0.0.1"

    services = [
        {"id": "gateway", "name": "통합 게이트웨이", "port": 9000, "url": "http://127.0.0.1:9000/health"},
        {"id": "mqhome", "name": "MQnet 브랜드 홈페이지", "port": 9001, "url": "http://127.0.0.1:9000/mqhome/"},
        {"id": "studycafe", "name": "스터디카페 관리", "port": 9002, "url": f"http://{host_ip}:9002/docs"},
        {"id": "selfstudy", "name": "자기주도학습 (SelfStudy)", "port": 9003, "url": f"http://{host_ip}:9003/docs"},
        {"id": "store", "name": "매장 관제 & POS", "port": 9004, "url": f"http://{host_ip}:9004/docs"},
        {"id": "mqfarm", "name": "MQFarm 센서 관제", "port": 9005, "url": f"http://{host_ip}:9005/docs"},
        {"id": "photos", "name": "스마트 갤러리 (Immich)", "port": 9006, "url": f"http://{host_ip}:9006"},
        {"id": "filebrowser", "name": "통합 파일 탐색기", "port": 9007, "url": f"http://{host_ip}:9007"},
        {"id": "ytdownloader", "name": "유튜브 다운로더", "port": 9008, "url": "http://127.0.0.1:9000/ytdownloader/"},
        {"id": "ai_gwansang", "name": "AI 관상 분석", "port": 9009, "url": f"http://{host_ip}:9009/docs"},
        {"id": "face_analy", "name": "테토/에겐 AI 얼굴분석", "port": 9010, "url": "http://127.0.0.1:9000/face_analy/"},
        {"id": "ironman", "name": "아이언맨 제스처 게임", "port": 9011, "url": "http://127.0.0.1:9000/ironman/"},
        {"id": "clock", "name": "모던 스마트 클락", "port": 9012, "url": "http://127.0.0.1:9000/clock/"},
        {"id": "videobooth", "name": "레트로 TV 비디오 부스", "port": 9013, "url": "http://127.0.0.1:9000/videobooth/"},
        {"id": "n8n_editor", "name": "n8n 비주얼 편집기", "port": 5678, "url": f"http://{host_ip}:5678/healthz"},
        {"id": "n8n_deposit", "name": "농협 입금 알림판", "port": 3000, "url": f"http://{host_ip}:3000/"},
        {"id": "grammar", "name": "Grammar Quest (AI 영문법)", "port": 9014, "url": "http://127.0.0.1:9000/grammar/"},
    ]

    def ping_sync(s: dict) -> dict:
        candidate_urls = [s["url"]]
        if "host.docker.internal" in s["url"]:
            candidate_urls.append(s["url"].replace("host.docker.internal", f"mqnet-{s['id']}".replace("_", "-")))
            candidate_urls.append(s["url"].replace("host.docker.internal", "127.0.0.1"))
        for target_url in candidate_urls:
            try:
                req = urllib.request.Request(target_url, headers={"User-Agent": "MQnet-HealthChecker/1.0"})
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    status_code = resp.getcode()
                    if status_code in (200, 301, 302, 307, 401, 403, 404):
                        return {**s, "online": True, "status_code": status_code}
            except urllib.error.HTTPError as he:
                if he.code in (200, 301, 302, 307, 401, 403, 404):
                    return {**s, "online": True, "status_code": he.code}
            except Exception:
                pass
        return {**s, "online": False, "status_code": None}

    results = await asyncio.gather(*(asyncio.to_thread(ping_sync, s) for s in services))

    # 시스템 리소스 (디스크 용량)
    storage_info = {}
    media_env = os.getenv("MEDIA_STORAGE_PATH", "/media")
    for path_candidate in [media_env, "/media", "L:\\", "/usr/src/app/external", "C:\\", "."]:
        if os.path.exists(path_candidate):
            try:
                usage = shutil.disk_usage(path_candidate)
                storage_info = {
                    "path": path_candidate,
                    "total_gb": round(usage.total / (1024**3), 1),
                    "used_gb": round(usage.used / (1024**3), 1),
                    "free_gb": round(usage.free / (1024**3), 1),
                    "percent_used": round((usage.used / usage.total) * 100, 1)
                }
                break
            except Exception:
                pass

    online_count = sum(1 for r in results if r["online"])
    return {
        "status": "HEALTHY" if online_count >= 10 else "DEGRADED",
        "total_services": len(results),
        "online_services": online_count,
        "services": results,
        "storage": storage_info
    }


@app.get("/health", tags=["플랫폼"])
async def platform_health(request: Request):
    """
    통합 플랫폼 헬스체크.
    브라우저 직접 접속 시 시각적인 한글 대시보드로도 볼 수 있으며,
    상세한 앱 목록과 설명이 포함됩니다.
    """
    apps = list_apps()
    
    accept = request.headers.get("accept", "")
    # 브라우저 직접 요청 시 깔끔한 HTML 카드 뷰 제공
    if "text/html" in accept and not request.query_params.get("json"):
        apps_html = "".join([
            f"""<li style="margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.04); padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
                <span style="font-size: 1.5rem;">{a['icon']}</span>
                <div>
                  <div style="font-weight: 700; color: #f8fafc;">{a['name']} <span style="font-size: 0.75rem; color: #a5b4fc; background: rgba(99,102,241,0.15); padding: 0.15rem 0.4rem; border-radius: 6px; font-family: monospace;">{a['id']} (포트 {a['port']})</span></div>
                  <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.15rem;">{a['description']}</div>
                </div>
              </li>"""
            for a in apps
        ])
        html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>MQnet 시스템 헬스체크</title>
  <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700&family=Outfit:wght@600;700&display=swap" rel="stylesheet">
  <style>
    body {{ font-family: 'Pretendard', sans-serif; background: #0a0e17; color: #f8fafc; margin: 0; padding: 2rem; display: flex; justify-content: center; align-items: center; min-height: 100vh; }}
    .box {{ background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; max-width: 600px; width: 100%; padding: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }}
    .badge {{ display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }}
    .dot {{ width: 8px; height: 8px; border-radius: 50%; background: #10b981; }}
    .btn {{ display: inline-block; padding: 0.5rem 1rem; border-radius: 8px; background: rgba(255,255,255,0.06); color: white; text-decoration: none; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.1); margin-top: 1.5rem; }}
    ul {{ list-style: none; padding: 0; margin: 1.25rem 0; }}
  </style>
</head>
<body>
  <div class="box">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
      <h2 style="margin: 0; font-size: 1.4rem;">⚡ MQnet 시스템 상태</h2>
      <div class="badge"><div class="dot"></div>정상 가동 중 (Healthy)</div>
    </div>
    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">현재 단일 백엔드 서버(포트 10000)에서 동작 중인 <b>5개 SaaS 서비스 목록</b>:</p>
    <ul>{apps_html}</ul>
    <div style="display: flex; gap: 0.75rem;">
      <a href="/" class="btn" style="background: linear-gradient(135deg, #6366f1, #a855f7);">🏠 메인 포털 홈으로 이동</a>
      <a href="/health?json=1" class="btn">📋 JSON 원본 보기</a>
    </div>
  </div>
</body>
</html>"""
        return HTMLResponse(content=html)

    return {
        "status": "healthy (정상 가동 중)",
        "platform": "MQnet 통합 SaaS 플랫폼",
        "registered_apps_count": len(apps),
        "apps": apps,
    }


@app.get("/store/qr/{table_number}", response_class=HTMLResponse, tags=["매장 - 고객 QR 전용 모바일 웹"])
async def customer_qr_page(table_number: str):
    """고객이 테이블 QR 코드를 촬영했을 때 표시되는 전용 모바일 웹 주문 화면"""
    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MQstore 스마트 오더 - {table_number}</title>
  <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700;800&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Pretendard', sans-serif; background: #0b0f19; color: #f8fafc; padding: 1.25rem; min-height: 100vh; }}
    .header {{ text-align: center; padding: 1rem 0 1.5rem; }}
    .badge {{ display: inline-block; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 700; background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); margin-bottom: 0.5rem; }}
    .card {{ background: #131b2e; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.25rem; margin-bottom: 1rem; }}
    .menu-item {{ display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }}
    .menu-item:last-child {{ border-bottom: none; }}
    .price {{ color: #fbbf24; font-weight: 700; }}
    .btn-main {{ width: 100%; padding: 1rem; border-radius: 14px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; font-size: 1.05rem; font-weight: 800; border: none; cursor: pointer; }}
    .res-box {{ margin-top: 1rem; padding: 1rem; border-radius: 12px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); display: none; }}
  </style>
</head>
<body>
  <div class="header">
    <div class="badge">🍽️ 스마트 테이블 오더</div>
    <h1 style="font-size: 1.5rem; font-weight: 800;">MQstore {table_number}</h1>
    <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.3rem;">비대면으로 편리하게 주문하세요</p>
  </div>

  <div class="card">
    <div style="font-size: 0.9rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.75rem;">📋 메뉴 선택</div>
    <div id="menuContainer">메뉴를 불러오는 중...</div>
  </div>

  <div class="card">
    <div style="font-size: 0.85rem; font-weight: 700; color: #94a3b8; margin-bottom: 0.5rem;">요청사항</div>
    <input type="text" id="reqNote" placeholder="예: 시럽 1번만 넣어주세요" style="width: 100%; padding: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white;">
  </div>

  <button class="btn-main" onclick="submitOrder()">📱 주문 전송하기</button>
  <div id="resultBox" class="res-box"></div>

  <script>
    const tbl = "{table_number}";
    let products = [];

    async function loadMenu() {{
      const res = await fetch('/api/store/inventory/products');
      const data = await res.json();
      products = data.products || [];
      const c = document.getElementById('menuContainer');
      c.innerHTML = products.map((p, idx) => `
        <div class="menu-item">
          <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; flex:1;">
            <input type="checkbox" name="menuChoice" value="${{p.name}}" data-price="${{p.price}}" ${{idx===0?'checked':''}}>
            <div>
              <div style="font-weight:600;">${{p.name}}</div>
              <div style="font-size:0.75rem; color:#94a3b8;">재고: ${{p.stock_quantity}}개</div>
            </div>
          </label>
          <span class="price">${{p.price.toLocaleString()}}원</span>
        </div>
      `).join('');
    }}

    async function submitOrder() {{
      const box = document.getElementById('resultBox');
      box.style.display = 'block';
      const note = document.getElementById('reqNote').value;
      const checked = Array.from(document.querySelectorAll('input[name="menuChoice"]:checked'));
      if (checked.length === 0) {{
        box.innerHTML = '<span style="color:#ef4444;">최소 1개 이상의 메뉴를 선택해주세요.</span>';
        return;
      }}
      const items = checked.map(c => ({{
        product_name: c.value,
        price: parseFloat(c.getAttribute('data-price')),
        quantity: 1
      }}));

      box.innerHTML = '🔄 주방으로 주문 전송 중...';
      const res = await fetch('/api/store/orders/qr', {{
        method: 'POST',
        headers: {{'Content-Type': 'application/json'}},
        body: JSON.stringify({{table_number: tbl, items: items, note: note}})
      }});
      const data = await res.json();
      if (res.ok) {{
        box.innerHTML = `
          <div style="color:#34d399; font-weight:700;">✅ ${{data.message}}</div>
          <div style="font-size:0.85rem; margin-top:0.4rem; color:#cbd5e1;">
            • 주문번호: <b>${{data.order_number}}</b><br>
            • 금액: <b>${{(data.total_amount||0).toLocaleString()}}원</b><br>
            • 예상 대기: <b>${{data.estimated_wait}}</b>
          </div>
        `;
      }} else {{
        box.innerHTML = '<span style="color:#ef4444;">오류: ' + (data.detail || '주문 실패') + '</span>';
      }}
    }}

    loadMenu();
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gateway.main:app", host="0.0.0.0", port=10000, reload=True)