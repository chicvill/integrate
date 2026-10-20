"""
main.py — rent2 (객체 모델 임차관리) FastAPI 앱 팩토리.

  py apps/rent2/run.py        → http://localhost:9016/        (기존 화면 그대로 + AI 비서 /ai.html)
"""
import os
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as HTTPError

from .api import router
from .domain import bootstrap
from .kernel.base import actor, use_store
from .kernel.identity import User

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))          # apps/rent2
LEGACY = os.path.join(ROOT, "..", "rent")                                      # apps/rent (화면·시드 재사용)


class UI(StaticFiles):
    """rent2/frontend 우선, 없으면 기존 rent/frontend 재사용. 구버전 스크립트 충돌 방지를 위해 캐시 무효화."""

    def __init__(self, *dirs: str):
        super().__init__(directory=dirs[0], html=True)
        self.fallbacks = [StaticFiles(directory=d, html=True) for d in dirs[1:] if os.path.isdir(d)]

    async def get_response(self, path: str, scope: Any):
        try:
            res = await super().get_response(path, scope)
        except HTTPError as e:
            if e.status_code != 404:
                raise
            res = None
            for fb in self.fallbacks:
                try:
                    res = await fb.get_response(path, scope)
                    break
                except HTTPError:
                    continue
            if res is None:
                raise
        res.headers["Cache-Control"] = "no-store"
        return res


def create_app(db_path: str = "") -> FastAPI:
    path = db_path or os.getenv("RENT2_DB") or os.path.join(ROOT, "data", "rent2.db")
    if path != ":memory:":
        os.makedirs(os.path.dirname(path), exist_ok=True)
    use_store(path)
    bootstrap(os.path.join(LEGACY, "backend", "seed_data.json"))

    app = FastAPI(title="MQnet 원룸 임차관리 (rent2 · 객체 모델)", version="2.0.0")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def who(request: Request, call_next):          # 모든 변경 기록에 '누가'를 남긴다
        u = User.from_token(request.headers.get("authorization", ""))
        actor.set(u.username if u else "anonymous")
        return await call_next(request)

    for exc, code in ((LookupError, 404), (PermissionError, 403), (ValueError, 400)):
        app.add_exception_handler(exc, lambda r, e, c=code: JSONResponse({"detail": str(e).strip("'\"")}, status_code=c))

    app.include_router(router, prefix="/api/rent")
    app.include_router(router, prefix="/api")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "app": "rent2", "model": "object"}

    ui = UI(os.path.join(ROOT, "frontend"), os.path.join(LEGACY, "frontend"))
    app.mount("/rent", ui, name="ui_rent")      # 게이트웨이 경로(/rent/…) 호환
    app.mount("/", ui, name="ui")
    return app
