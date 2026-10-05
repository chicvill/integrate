"""
gateway/main.py
모든 SaaS 앱을 단일 포트에서 서비스하는 통합 API 게이트웨이 및 웹 포털.
"""
import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from shared.auth.router import auth_router
from shared.tenant.registry import list_apps, get_app_config
from shared.tenant.middleware import app_context_middleware

# 각 앱 라우터 임포트
from apps.studycafe.backend.routers import seat_router, ticket_router, session_router
from apps.store.backend.routers import order_router, menu_router, table_router
from apps.selfstudy.backend.routers import plan_router, progress_router, ai_router as study_ai_router
from apps.smartfarm.backend.routers import sensor_router, farm_router, control_router
from apps.ai_gwansang.backend.routers.analysis_router import router as gwansang_router

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

# 미들웨어
app.middleware("http")(app_context_middleware)

# 공통 인증 라우터
app.include_router(auth_router, prefix="/auth", tags=["공통 인증 (X-App-ID 필수)"])
app.include_router(auth_router, prefix="/api/auth", tags=["공통 인증 (프론트엔드 호환)"])
app.include_router(auth_router, prefix="/api", tags=["공통 인증 (/api/me 호환)"])

# 1. 스터디카페 앱
app.include_router(seat_router, prefix="/api/studycafe/seats", tags=["스터디카페 - 좌석"])
app.include_router(ticket_router, prefix="/api/studycafe/tickets", tags=["스터디카페 - 이용권"])
app.include_router(session_router, prefix="/api/studycafe/sessions", tags=["스터디카페 - 세션"])

# 2. 매장 QR 주문 앱
app.include_router(table_router, prefix="/api/store/tables", tags=["매장 - 테이블"])
app.include_router(menu_router, prefix="/api/store/menu", tags=["매장 - 메뉴"])
app.include_router(order_router, prefix="/api/store/orders", tags=["매장 - 주문"])

# 3. 자기주도학습 앱
app.include_router(plan_router, prefix="/api/selfstudy/plans", tags=["자기주도학습 - 계획"])
app.include_router(progress_router, prefix="/api/selfstudy/progress", tags=["자기주도학습 - 진도"])
app.include_router(study_ai_router, prefix="/api/selfstudy/ai", tags=["자기주도학습 - AI 멘토"])

# 4. 스마트팜 앱
app.include_router(farm_router, prefix="/api/smartfarm/farms", tags=["스마트팜 - 농장"])
app.include_router(sensor_router, prefix="/api/smartfarm/sensors", tags=["스마트팜 - 센서"])
app.include_router(control_router, prefix="/api/smartfarm/controls", tags=["스마트팜 - 제어"])

# 5. AI 관상 앱
app.include_router(gwansang_router, prefix="/api/ai_gwansang", tags=["AI 관상 분석"])
app.include_router(gwansang_router, prefix="/api", tags=["AI 관상 분석 (React 프론트엔드 직접 호환)"])


# ─── React 프론트엔드 정적 파일 마운트 (/apps/gwansang) ─────
gwansang_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "ai_gwansang", "frontend", "dist"))
if os.path.exists(gwansang_dist):
    app.mount("/apps/gwansang", StaticFiles(directory=gwansang_dist, html=True), name="gwansang_app")
    logger.info(f"AI 관상 React 프론트엔드 마운트 완료: {gwansang_dist}")


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


@app.get("/health", tags=["플랫폼"])
async def platform_health(request: Request):
    apps = list_apps()
    accept = request.headers.get("accept", "")
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
      <a href="/apps/gwansang" class="btn" style="background: linear-gradient(135deg, #a855f7, #ec4899);">🔮 AI 관상 풀 앱 실행</a>
      <a href="/health?json=1" class="btn">📋 JSON 보기</a>
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gateway.main:app", host="0.0.0.0", port=10000, reload=True)