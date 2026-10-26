"""
core/loader.py — 제로터치 자동 디스커버리 & 결함 격리 엔진 `SaaSAppManager`.

apps/<폴더>/app.py 를 가진 모든 폴더를 찾아 BaseSaaSApp 객체로 만들고
게이트웨이에 마운트한다. 게이트웨이 코드는 앱이 몇 개든 수정할 필요가 없다.

단계별(import → resolve → router → startup → mount) 실패는 해당 앱만 격리되며,
격리된 앱의 경로는 503 + 원인 안내로 응답한다. 나머지 앱은 정상 서비스된다.
"""
import importlib
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional

from fastapi import APIRouter, FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

from .app_base import BaseSaaSApp
from .kernel.obj import APP_PACKAGES
from .web import NoCacheStaticFiles

logger = logging.getLogger("bass.loader")
DISABLED_MARKER = ".disabled"


@dataclass
class AppFailure:
    folder: str
    stage: str
    reason: str
    at: float = field(default_factory=time.time)


class SaaSAppManager:
    def __init__(self) -> None:
        self.apps: Dict[str, BaseSaaSApp] = {}
        self.failed: Dict[str, AppFailure] = {}
        self.disabled: List[str] = []
        self.load_ms: Dict[str, float] = {}

    # ── 공개 API ──
    def discover_and_mount(self, fastapi_app: FastAPI, apps_root: str,
                           only: Optional[List[str]] = None, standalone: bool = False) -> "SaaSAppManager":
        """apps_root 아래 모든 앱을 발견하여 마운트한다.

        only       : 지정 시 해당 폴더만 로드 (단독 실행 / 부분 배포)
        standalone : True 면 앱 1개를 /api, / 루트에 마운트 (독립 패키지 모드)
        """
        apps_root = os.path.abspath(apps_root)
        package = os.path.basename(apps_root)
        parent = os.path.dirname(apps_root)
        if parent not in sys.path:
            sys.path.insert(0, parent)
        APP_PACKAGES.add(package)

        for folder in self._candidates(apps_root, only):
            started = time.perf_counter()
            self._load_one(fastapi_app, apps_root, package, folder, standalone)
            self.load_ms[folder] = round((time.perf_counter() - started) * 1000, 1)
        logger.info("앱 로드 완료: 정상 %d / 격리 %d / 비활성 %d",
                    len(self.apps), len(self.failed), len(self.disabled))
        return self

    def shutdown(self) -> None:
        for app in self.apps.values():
            try:
                app.on_shutdown()
            except Exception:
                logger.exception("[%s] on_shutdown 실패", app.app_id)

    def subdomain_map(self) -> Dict[str, str]:
        return {host.lower(): app.app_id for app in self.apps.values() for host in app.subdomains}

    def catalog(self) -> Dict[str, object]:
        apps = sorted((a.portal_meta() for a in self.apps.values()), key=lambda m: (m["order"], m["app_name"]))
        return {
            "success": True,
            "total": len(self.apps),
            "apps": apps,
            "failed": [asdict(f) for f in self.failed.values()],
            "disabled": list(self.disabled),
        }

    def health(self) -> Dict[str, object]:
        per_app = {app_id: app.health() for app_id, app in self.apps.items()}
        for folder, failure in self.failed.items():
            per_app[folder] = {"app_id": folder, "status": "ISOLATED", "stage": failure.stage, "reason": failure.reason}
        degraded = any(v["status"] != "HEALTHY" for v in per_app.values())
        return {"status": "DEGRADED" if degraded else "HEALTHY", "apps": per_app}

    # ── 내부 ──
    def _candidates(self, apps_root: str, only: Optional[List[str]]) -> List[str]:
        result = []
        for folder in sorted(os.listdir(apps_root)):
            path = os.path.join(apps_root, folder)
            if folder.startswith(("_", ".")) or not os.path.isdir(path):
                continue
            if not os.path.exists(os.path.join(path, "app.py")):
                continue
            if only and folder not in only:
                continue
            if os.path.exists(os.path.join(path, DISABLED_MARKER)):
                self.disabled.append(folder)
                continue
            result.append(folder)
        if only:
            missing = set(only) - set(result) - set(self.disabled)
            for folder in sorted(missing):
                self.failed[folder] = AppFailure(folder, "discover", f"apps/{folder}/app.py 가 없습니다.")
        return result

    def _load_one(self, fastapi_app: FastAPI, apps_root: str, package: str, folder: str, standalone: bool) -> None:
        stage = "discover"
        try:
            if not folder.isidentifier():
                raise ValueError(f"폴더명 '{folder}' 은 파이썬 식별자 규칙(영문/숫자/_)을 따라야 합니다.")

            stage = "import"
            module = importlib.import_module(f"{package}.{folder}.app")

            stage = "resolve"
            app = self._resolve_instance(module, os.path.join(apps_root, folder))
            if app.app_id != folder:
                raise ValueError(f"app_id '{app.app_id}' 가 폴더명 '{folder}' 과 다릅니다. 둘을 일치시켜 주세요.")

            stage = "router"
            router = app.get_router()
            if not isinstance(router, APIRouter):
                raise TypeError(f"get_router() 는 APIRouter 를 반환해야 합니다 (받은 값: {type(router).__name__}).")

            stage = "startup"
            app.on_startup()

            stage = "mount"
            api_prefix = "/api" if standalone else f"/api/{app.app_id}"
            fastapi_app.include_router(router, prefix=api_prefix, tags=[f"{app.icon} {app.app_name}"])
            static_dir = app.get_static_dir()
            if static_dir and not standalone:
                fastapi_app.mount(f"/{app.app_id}", NoCacheStaticFiles(directory=static_dir, html=True),
                                  name=f"app_{app.app_id}")
            self.apps[app.app_id] = app
            logger.info("✅ [%s] %s 마운트 완료", app.app_id, app.app_name)
        except Exception as e:
            logger.exception("❌ [%s] %s 단계 실패 → 격리", folder, stage)
            self.failed[folder] = AppFailure(folder, stage, f"{type(e).__name__}: {e}")
            self._mount_quarantine(fastapi_app, folder)

    @staticmethod
    def _resolve_instance(module, base_dir: str) -> BaseSaaSApp:
        instance = getattr(module, "app_instance", None)
        if isinstance(instance, BaseSaaSApp):
            return instance
        classes = [v for v in vars(module).values()
                   if isinstance(v, type) and issubclass(v, BaseSaaSApp)
                   and v is not BaseSaaSApp and v.__module__ == module.__name__]
        if len(classes) != 1:
            raise LookupError(f"app.py 에 app_instance 가 없고 BaseSaaSApp 하위 클래스가 {len(classes)}개입니다 (정확히 1개 필요).")
        return classes[0](base_dir=base_dir)

    def _mount_quarantine(self, fastapi_app: FastAPI, folder: str) -> None:
        """격리된 앱 경로가 404 대신 원인을 안내하도록 대체 라우트를 둔다."""
        manager = self

        def payload():
            f = manager.failed.get(folder)
            return {"success": False, "level": "error",
                    "message": f"'{folder}' 앱은 로드 오류로 일시 격리되었습니다. 다른 앱은 정상 운영 중입니다.",
                    "hint": "관리자: 포털의 '격리된 앱' 패널에서 단계/원인을 확인 후 수정하고 서버를 재시작하세요.",
                    "stage": f.stage if f else "", "reason": f.reason if f else ""}

        async def api_fallback(path: str = ""):
            return JSONResponse(payload(), status_code=503)

        async def page_fallback(path: str = ""):
            p = payload()
            return HTMLResponse(_QUARANTINE_HTML.format(folder=folder, stage=p["stage"],
                                                        reason=_escape(p["reason"])), status_code=503)

        for route in (f"/api/{folder}", f"/api/{folder}/{{path:path}}"):
            fastapi_app.add_api_route(route, api_fallback, methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                                      include_in_schema=False)
        for route in (f"/{folder}", f"/{folder}/{{path:path}}"):
            fastapi_app.add_api_route(route, page_fallback, methods=["GET"], include_in_schema=False)


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


_QUARANTINE_HTML = """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{folder} — 일시 격리됨</title>
<link rel="stylesheet" href="/shared/ui/base.css"></head>
<body class="bass-center"><main class="bass-card" style="max-width:560px">
<h1>🛡️ '{folder}' 앱이 일시 격리되었습니다</h1>
<p>로드 중 오류가 발생하여 이 앱만 안전하게 분리했습니다. 다른 앱은 정상 운영 중입니다.</p>
<p><b>실패 단계</b>: {stage}<br><b>원인</b>: <code>{reason}</code></p>
<p><a class="bass-btn" href="/">← 포털로 돌아가기</a></p></main></body></html>"""
