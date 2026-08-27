"""apps/store/backend/main.py - 매장 앱 진입점"""
import logging
from shared.core.base_app import create_base_app
from shared.auth.router import auth_router
from .config import get_settings
from .routers import menu_router, order_router, table_router

logging.basicConfig(level=logging.INFO)

settings = get_settings()
app = create_base_app(settings, include_auth=False)

app.include_router(auth_router, prefix="/auth", tags=["인증 (공통)"])
app.include_router(table_router, prefix="/tables", tags=["테이블 관리"])
app.include_router(menu_router, prefix="/menu", tags=["메뉴 관리"])
app.include_router(order_router, prefix="/orders", tags=["주문 관리"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.store.backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
