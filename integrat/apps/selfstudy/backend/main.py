"""apps/selfstudy/backend/main.py - 자기주도학습 앱 진입점"""
import logging
from shared.core.base_app import create_base_app
from shared.auth.router import auth_router
from .config import get_settings
from .routers import plan_router, progress_router, ai_router

logging.basicConfig(level=logging.INFO)

settings = get_settings()
app = create_base_app(settings, include_auth=False)

app.include_router(auth_router, prefix="/auth", tags=["인증 (공통)"])
app.include_router(plan_router, prefix="/plans", tags=["학습 계획"])
app.include_router(progress_router, prefix="/progress", tags=["학습 진도"])
app.include_router(ai_router, prefix="/ai", tags=["AI 멘토"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.selfstudy.backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
