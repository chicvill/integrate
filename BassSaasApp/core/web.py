"""core/web.py — 웹 서빙 공통 유틸."""
from fastapi.staticfiles import StaticFiles


class NoCacheStaticFiles(StaticFiles):
    """정적 파일 브라우저 캐시 무효화 → 배포 직후 구버전 스크립트 충돌 방지."""

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
