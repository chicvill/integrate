"""
apps/studycafe/backend/main.py
스터디카페 앱 진입점.
shared의 공통 모듈을 상속/활용합니다.
"""
import logging
from fastapi import FastAPI
from shared.core.base_app import create_base_app
from shared.auth.router import auth_router
from .config import get_settings
from .routers import seat_router, ticket_router, session_router

logging.basicConfig(level=logging.INFO)

settings = get_settings()

# 공통 팩토리로 앱 생성 (CORS, 헬스체크, 로깅 미들웨어 자동 등록)
app: FastAPI = create_base_app(settings, include_auth=False)

# 공통 인증 라우터 등록
app.include_router(auth_router, prefix="/auth", tags=["인증 (공통)"])

# 스터디카페 전용 라우터 등록
app.include_router(seat_router, prefix="/seats", tags=["좌석 관리"])
app.include_router(ticket_router, prefix="/tickets", tags=["이용권 관리"])
app.include_router(session_router, prefix="/sessions", tags=["이용 세션"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.studycafe.backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
