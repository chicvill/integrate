"""
shared/tenant/middleware.py
X-App-ID 헤더 기반 앱 식별 미들웨어.
"""
from fastapi import Request, HTTPException
from shared.tenant.registry import get_app_config, is_registered_app


async def app_context_middleware(request: Request, call_next):
    """
    모든 요청에서 X-App-ID 헤더를 읽어 앱 설정을 request.state에 주입합니다.
    gateway에서만 사용하고, 개별 앱 서버에서는 base_app.py의 inject_app_context 사용.
    """
    app_id = request.headers.get("x-app-id") or request.query_params.get("app_id")
    
    if app_id and is_registered_app(app_id):
        request.state.x_app_id = app_id
        request.state.app_config = get_app_config(app_id)
    
    return await call_next(request)
