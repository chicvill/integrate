"""apps/smartfarm/backend/main.py - 스마트팜 앱 진입점"""
import logging
from shared.core.base_app import create_base_app
from shared.auth.router import auth_router
from .config import get_settings
from .routers import sensor_router, farm_router, control_router

logging.basicConfig(level=logging.INFO)

settings = get_settings()
app = create_base_app(settings, include_auth=False)

app.include_router(auth_router, prefix="/auth", tags=["인증 (공통)"])
app.include_router(farm_router, prefix="/farms", tags=["농장 관리"])
app.include_router(sensor_router, prefix="/sensors", tags=["센서 모니터링"])
app.include_router(control_router, prefix="/controls", tags=["장치 제어"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.smartfarm.backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
