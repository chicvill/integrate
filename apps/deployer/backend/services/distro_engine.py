"""
apps/deployer/backend/services/distro_engine.py
MQnet Solution Distro & Packaging Engine
원하는 앱(단일 또는 복수)과 대상 인프라, 데이터 정책을 조합하여
즉시 분리 설치 및 업그레이드가 가능한 독립 납품용 패키지(.ZIP)를 자동 생성합니다.
"""
import os
import sys
import shutil
import zipfile
import json
import time
from datetime import datetime
from typing import List, Dict, Any, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
APPS_DIR = os.path.join(PROJECT_ROOT, "apps")
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, "templates", "saas-template")
SHARED_DIR = os.path.join(PROJECT_ROOT, "shared")
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")

APP_CATALOG = {
    "rent": {
        "id": "rent",
        "name": "부동산 임차관리 시스템 (29개실)",
        "icon": "🏢",
        "category": "부동산/자산관리",
        "description": "29개실 호실 계약, 12개월 납부 장부, 만기 도래(3일/1달/3달) 자동 알림, 부가세 리포트",
        "default_port": 8000,
        "db_filename": "rent.db",
        "possible_source_dbs": ["integrat.db", "integrated.db", "rent.db"],
        "is_ready": True
    },
    "studycafe": {
        "id": "studycafe",
        "name": "무인 스터디카페 관제 시스템",
        "icon": "☕",
        "category": "공간/무인운영",
        "description": "실시간 좌석 배치도, IoT 스마트 도어락 원격 개폐, 키오스크 이용권 및 시간제 세션",
        "default_port": 8001,
        "db_filename": "studycafe.db",
        "is_ready": True
    },
    "store": {
        "id": "store",
        "name": "매장 스마트 POS & 테이블 오더",
        "icon": "🍽️",
        "category": "F&B/유통",
        "description": "테이블별 모바일 QR 비대면 주문, 실시간 주방 관제, 상품 재고 및 매출 분석",
        "default_port": 8002,
        "db_filename": "store.db",
        "is_ready": True
    },
    "selfstudy": {
        "id": "selfstudy",
        "name": "자기주도학습 AI 멘토링 포털",
        "icon": "📚",
        "category": "에듀테크",
        "description": "학습 계획 플래너, 진도 체크, AI 학습 멘토링 및 학부모 안심 출결 참관 포털",
        "default_port": 8003,
        "db_filename": "selfstudy.db",
        "is_ready": True
    },
    "files": {
        "id": "files",
        "name": "MQnet Files Hub (통합 파일 스토리지)",
        "icon": "📁",
        "category": "인프라/스토리지",
        "description": "사내 문서·미디어 웹 탐색기, 대용량 파일 업/다운로드, 접근 권한 관리",
        "default_port": 8004,
        "db_filename": "files.db",
        "is_ready": True
    },
    "ytdownloader": {
        "id": "ytdownloader",
        "name": "유튜브 고화질 미디어 다운로더",
        "icon": "🎬",
        "category": "미디어",
        "description": "유튜브 영상/음원 최고화질 원클릭 추출 및 아카이빙 라이브러리",
        "default_port": 8005,
        "db_filename": "ytdownloader.db",
        "is_ready": True
    },
    "mqfarm": {
        "id": "mqfarm",
        "name": "스마트팜 센서 관제 & 제어",
        "icon": "🌱",
        "category": "IoT/스마트농업",
        "description": "온습도/조도 센서 실시간 모니터링 및 관수/환기 액추에이터 원격 자동 제어",
        "default_port": 8006,
        "db_filename": "farm.db",
        "is_ready": True
    }
}


class DistroEngine:
    def __init__(self):
        os.makedirs(DIST_DIR, exist_ok=True)

    def get_apps_status(self) -> List[Dict[str, Any]]:
        """배포 가능한 앱 목록 및 현재 DB 크기 스캔"""
        result = []
        for app_id, meta in APP_CATALOG.items():
            app_dir = os.path.join(APPS_DIR, app_id)
            exists = os.path.exists(app_dir)
            db_size_str = "DB 없음 (0 KB)"
            has_db = False

            # DB 파일 위치 탐색
            src_names = meta.get("possible_source_dbs", [meta["db_filename"]])
            possible_db_paths = []
            for name in src_names:
                possible_db_paths.extend([
                    os.path.join(PROJECT_ROOT, name),
                    os.path.join(PROJECT_ROOT, "data", name),
                    os.path.join(app_dir, "data", name),
                    os.path.join(app_dir, "backend", name)
                ])

            for p in possible_db_paths:
                if os.path.exists(p) and os.path.getsize(p) > 0:
                    sz = os.path.getsize(p)
                    db_size_str = f"실데이터 보유 ({round(sz / 1024, 1)} KB)"
                    has_db = True
                    break

            result.append({
                **meta,
                "is_installed": exists,
                "has_database": has_db,
                "db_status_text": db_size_str
            })
        return result

    def build_package(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        배포 패키지 생성 마법사
        payload:
          - selected_apps: list[str] (예: ['rent', 'studycafe'])
          - target_platform: 'docker-linux' | 'windows-pc' | 'all'
          - data_policy: 'clean' | 'current' | 'sample'
          - package_type: 'full' | 'patch'
          - server_name: str (옵션: '고객사 전용 독립 서버')
        """
        selected_apps = payload.get("selected_apps", ["rent"])
        if not selected_apps:
            raise ValueError("최소 1개 이상의 앱을 선택해야 합니다.")

        target_platform = payload.get("target_platform", "docker-linux")
        data_policy = payload.get("data_policy", "clean")
        package_type = payload.get("package_type", "full")
        server_name = payload.get("server_name", "MQnet 솔루션 전용 서버")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        apps_slug = "_".join(selected_apps) if len(selected_apps) <= 2 else f"{selected_apps[0]}_plus_{len(selected_apps)-1}"
        pkg_base_name = f"mqnet_{apps_slug}_{target_platform}_{data_policy}_{timestamp}"
        build_temp_dir = os.path.join(DIST_DIR, f"temp_{pkg_base_name}")
        zip_filename = f"{pkg_base_name}.zip"
        zip_filepath = os.path.join(DIST_DIR, zip_filename)

        if os.path.exists(build_temp_dir):
            shutil.rmtree(build_temp_dir)
        os.makedirs(build_temp_dir, exist_ok=True)

        try:
            is_multi = len(selected_apps) > 1

            if not is_multi:
                # ── [A] 단일 앱 패키징 ──
                app_id = selected_apps[0]
                self._package_single_app(
                    app_id=app_id,
                    target_dir=build_temp_dir,
                    target_platform=target_platform,
                    data_policy=data_policy,
                    package_type=package_type,
                    server_name=server_name
                )
            else:
                # ── [B] 다중 앱(Multi-App) 번들 패키징 ──
                self._package_multi_apps(
                    app_ids=selected_apps,
                    target_dir=build_temp_dir,
                    target_platform=target_platform,
                    data_policy=data_policy,
                    package_type=package_type,
                    server_name=server_name
                )

            # ── [C] ZIP 파일 압축 ──
            with zipfile.ZipFile(zip_filepath, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
                for root, dirs, files in os.walk(build_temp_dir):
                    for file in files:
                        full_p = os.path.join(root, file)
                        rel_p = os.path.relpath(full_p, build_temp_dir)
                        zipf.write(full_p, rel_p)

            zip_size = os.path.getsize(zip_filepath)
            zip_size_mb = round(zip_size / (1024 * 1024), 2)

            # 가이드 명령어 생성
            install_guide = self._generate_quick_guide(
                zip_filename=zip_filename,
                target_platform=target_platform,
                is_multi=is_multi,
                selected_apps=selected_apps
            )

            return {
                "success": True,
                "package_name": zip_filename,
                "file_size_bytes": zip_size,
                "file_size_mb": zip_size_mb,
                "download_url": f"/api/deployer/download/{zip_filename}",
                "selected_apps": selected_apps,
                "target_platform": target_platform,
                "data_policy": data_policy,
                "package_type": package_type,
                "created_at": datetime.now().isoformat(),
                "install_guide": install_guide
            }
        finally:
            # 임시 빌드 디렉토리 정리
            if os.path.exists(build_temp_dir):
                shutil.rmtree(build_temp_dir, ignore_errors=True)

    def _package_single_app(self, app_id: str, target_dir: str, target_platform: str, data_policy: str, package_type: str, server_name: str):
        """단일 앱 독립 패키지 구성"""
        app_dir = os.path.join(APPS_DIR, app_id)
        meta = APP_CATALOG.get(app_id, {"name": app_id, "default_port": 8000})

        ignore_pat = shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo", ".git*", "node_modules", "*.log")

        # 1. backend / frontend 복사
        for sub in ["backend", "frontend"]:
            s_dir = os.path.join(app_dir, sub)
            if os.path.exists(s_dir):
                shutil.copytree(s_dir, os.path.join(target_dir, sub), ignore=ignore_pat)

        # 루트 웹 파일 복사
        for fname in os.listdir(app_dir):
            fpath = os.path.join(app_dir, fname)
            if os.path.isfile(fpath) and fname not in ["Dockerfile", "docker-compose.yml"]:
                shutil.copy2(fpath, os.path.join(target_dir, fname))

        # 2. shared/core 의존성 번들링
        target_shared = os.path.join(target_dir, "shared")
        os.makedirs(target_shared, exist_ok=True)
        if os.path.exists(SHARED_DIR):
            src_core = os.path.join(SHARED_DIR, "core")
            if os.path.exists(src_core):
                shutil.copytree(src_core, os.path.join(target_shared, "core"), ignore=ignore_pat)
        with open(os.path.join(target_shared, "__init__.py"), "w", encoding="utf-8") as f:
            f.write("# MQnet Shared Core\n")

        # 3. 데이터 정책 처리
        data_dir = os.path.join(target_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        if data_policy == "current" and package_type == "full":
            src_names = meta.get("possible_source_dbs", [meta["db_filename"]])
            possible_dbs = []
            for name in src_names:
                possible_dbs.extend([
                    os.path.join(PROJECT_ROOT, name),
                    os.path.join(PROJECT_ROOT, "data", name),
                    os.path.join(app_dir, "data", name),
                    os.path.join(app_dir, "backend", name)
                ])
            copied = False
            for p in possible_dbs:
                if os.path.exists(p) and os.path.getsize(p) > 0:
                    shutil.copy2(p, os.path.join(data_dir, meta["db_filename"]))
                    # fallback용 복사 (rent.db <-> integrat.db)
                    for fallback_name in src_names:
                        shutil.copy2(p, os.path.join(data_dir, fallback_name))
                    copied = True
                    break
            if not copied:
                open(os.path.join(data_dir, ".clean_database_ready"), "w").close()
        else:
            open(os.path.join(data_dir, ".clean_database_ready"), "w").close()

        # 4. 플랫폼별 스크립트 주입
        replacements = {
            "{{APP_ID}}": app_id,
            "{{APP_NAME}}": meta["name"],
            "{{PORT}}": str(meta["default_port"])
        }
        self._inject_template_files(target_dir, replacements)

        # Linux용 원클릭 인스톨/업데이트 쉘 스크립트
        self._generate_linux_scripts(target_dir, app_id, meta["name"])

    def _package_multi_apps(self, app_ids: List[str], target_dir: str, target_platform: str, data_policy: str, package_type: str, server_name: str):
        """다중 앱 통합 번들 패키지 구성"""
        ignore_pat = shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo", ".git*", "node_modules", "*.log")

        # 1. 각 앱 복사 (apps/app_id/)
        apps_dest_dir = os.path.join(target_dir, "apps")
        os.makedirs(apps_dest_dir, exist_ok=True)
        with open(os.path.join(apps_dest_dir, "__init__.py"), "w", encoding="utf-8") as f:
            f.write("# Multi-App Package Apps\n")

        app_infos = []
        for a_id in app_ids:
            a_dir = os.path.join(APPS_DIR, a_id)
            dest = os.path.join(apps_dest_dir, a_id)
            shutil.copytree(a_dir, dest, ignore=ignore_pat)
            meta = APP_CATALOG.get(a_id, {"name": a_id, "default_port": 8000, "db_filename": f"{a_id}.db"})
            app_infos.append(meta)

        # 2. shared/core 복사
        target_shared = os.path.join(target_dir, "shared")
        os.makedirs(target_shared, exist_ok=True)
        if os.path.exists(SHARED_DIR):
            src_core = os.path.join(SHARED_DIR, "core")
            if os.path.exists(src_core):
                shutil.copytree(src_core, os.path.join(target_shared, "core"), ignore=ignore_pat)
        with open(os.path.join(target_shared, "__init__.py"), "w", encoding="utf-8") as f:
            f.write("# MQnet Shared Core\n")

        # 3. 데이터 정책 복사
        data_dir = os.path.join(target_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        if data_policy == "current" and package_type == "full":
            for meta in app_infos:
                src_names = meta.get("possible_source_dbs", [meta["db_filename"]])
                possible_dbs = []
                for name in src_names:
                    possible_dbs.extend([
                        os.path.join(PROJECT_ROOT, name),
                        os.path.join(PROJECT_ROOT, "data", name),
                        os.path.join(APPS_DIR, meta["id"], "data", name),
                        os.path.join(APPS_DIR, meta["id"], "backend", name)
                    ])
                for p in possible_dbs:
                    if os.path.exists(p) and os.path.getsize(p) > 0:
                        shutil.copy2(p, os.path.join(data_dir, meta["db_filename"]))
                        for fallback_name in src_names:
                            shutil.copy2(p, os.path.join(data_dir, fallback_name))
                        break

        # 4. 다중 앱 통합 실행기 (multi_runner.py) 생성
        self._generate_multi_runner(target_dir, app_infos, server_name)

        # 5. 다중 앱용 Dockerfile 및 docker-compose.yml 생성
        self._generate_multi_docker(target_dir, app_infos, server_name)

        # 6. Windows & Linux 통합 시작 스크립트
        self._generate_multi_scripts(target_dir, app_infos, server_name)

    def _inject_template_files(self, target_dir: str, replacements: Dict[str, str]):
        """단일 앱 템플릿 파일 치환 주입"""
        file_map = {
            "Dockerfile.standalone": "Dockerfile",
            "docker-compose.standalone.yml": "docker-compose.yml",
            "standalone_runner.py": "standalone_runner.py",
            "START_STANDALONE.bat": "START.bat",
            "UPDATE_STANDALONE.bat": "UPDATE.bat",
            "requirements.txt": "requirements.txt",
            "manual.html": "manual.html"
        }
        for src_name, dest_name in file_map.items():
            src_p = os.path.join(TEMPLATES_DIR, src_name)
            dest_p = os.path.join(target_dir, dest_name)
            if os.path.exists(src_p):
                with open(src_p, "r", encoding="utf-8") as f:
                    c = f.read()
                for k, v in replacements.items():
                    c = c.replace(k, v)
                with open(dest_p, "w", encoding="utf-8") as f:
                    f.write(c)

    def _generate_linux_scripts(self, target_dir: str, app_id: str, app_name: str):
        """Linux 환경용 원클릭 인스톨 및 업데이트 쉘 스크립트"""
        install_sh = f"""#!/bin/bash
# MQnet {app_name} 원클릭 자동 설치 스크립트
echo "========================================================"
echo "🚀 {app_name} 독립 서버 자동 설치 및 기동을 시작합니다"
echo "========================================================"

if ! command -v docker &> /dev/null; then
    echo "⚠️ Docker가 설치되어 있지 않습니다. Docker 엔진 설치를 진행합니다..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    sudo systemctl enable --now docker
fi

echo "📦 컨테이너 빌드 및 백그라운드 기동 중..."
sudo docker compose down 2>/dev/null || true
sudo docker compose up -d --build

echo "========================================================"
echo "✅ {app_name} 솔루션 가동이 성공적으로 완료되었습니다!"
echo "👉 웹 브라우저에서 서버 IP (포트 80)로 접속하세요."
echo "========================================================"
"""
        with open(os.path.join(target_dir, "install.sh"), "w", encoding="utf-8", newline="\n") as f:
            f.write(install_sh)

        update_sh = f"""#!/bin/bash
# MQnet {app_name} 원클릭 무중단 안전 업그레이드 스크립트
echo "========================================================"
echo "🔄 {app_name} 솔루션 안전 업그레이드를 시작합니다"
echo "========================================================"

# 데이터 자동 백업
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
if [ -d "./data" ]; then
    mkdir -p ./backups
    tar -czf ./backups/data_backup_$BACKUP_DATE.tar.gz ./data
    echo "🛡️ 기존 데이터가 안전하게 백업되었습니다: ./backups/data_backup_$BACKUP_DATE.tar.gz"
fi

echo "⚡ 최신 코드 및 의존성 반영 재빌드 중..."
sudo docker compose up -d --build

echo "========================================================"
echo "✅ 업그레이드가 성공적으로 완료되었습니다! (데이터 100% 보존)"
echo "========================================================"
"""
        with open(os.path.join(target_dir, "update.sh"), "w", encoding="utf-8", newline="\n") as f:
            f.write(update_sh)

    def _generate_multi_runner(self, target_dir: str, app_infos: List[Dict[str, Any]], server_name: str):
        """다중 앱 통합 실행 엔트리포인트 생성"""
        runner_code = f'''"""
multi_runner.py
MQnet Multi-App 통합 독립 서버 게이트웨이 및 호스팅 진입점.
선택된 모든 솔루션 앱을 단일 포트(80)에서 통합 서비스합니다.
"""
import os
import sys
import logging
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("multi_runner")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

app = FastAPI(
    title="{server_name}",
    description="MQnet 멀티 솔루션 독립 서버",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

APP_LIST = {json.dumps(app_infos, ensure_ascii=False, indent=2)}

@app.get("/api/health")
def health_check():
    return {{"status": "ok", "mode": "multi_standalone", "apps": [a["id"] for a in APP_LIST]}}

# 각 앱 라우터 및 프론트엔드 동적 마운트
for a in APP_LIST:
    a_id = a["id"]
    try:
        import importlib
        mod = importlib.import_module(f"apps.{{a_id}}.backend.routers.main_router")
        router = getattr(mod, "router", None)
        if router:
            app.include_router(router, prefix=f"/api/{{a_id}}")
            app.include_router(router, prefix=f"/api")
            logger.info(f"✅ [{{a_id}}] API 라우터 마운트 완료")
    except Exception as e:
        logger.warning(f"⚠️ [{{a_id}}] 라우터 로드 경고: {{e}}")

    # 프론트엔드 정적 서빙 (/rent, /studycafe 등)
    fe_dir = os.path.join(CURRENT_DIR, "apps", a_id, "frontend")
    if not os.path.exists(fe_dir):
        fe_dir = os.path.join(CURRENT_DIR, "apps", a_id)
    if os.path.exists(fe_dir):
        app.mount(f"/{{a_id}}", StaticFiles(directory=fe_dir, html=True), name=f"{{a_id}}_web")
        logger.info(f"✅ [{{a_id}}] 웹 프론트엔드 마운트 완료: /{{a_id}}")

# 루트 진입 시 통합 포털 렌더링
@app.get("/", response_class=HTMLResponse)
def root_portal():
    cards_html = ""
    for a in APP_LIST:
        cards_html += f"""
        <a href="/{{a['id']}}/" style="display:flex; align-items:center; gap:1.25rem; background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.1); border-radius:18px; padding:1.25rem 1.5rem; text-decoration:none; color:white; transition:all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.transform='none'">
            <div style="font-size:2.5rem; background:rgba(56,189,248,0.1); width:64px; height:64px; display:flex; align-items:center; justify-content:center; border-radius:14px;">{{a['icon']}}</div>
            <div>
                <div style="font-size:1.15rem; font-weight:700; color:#f8fafc;">{{a['name']}}</div>
                <div style="font-size:0.85rem; color:#94a3b8; margin-top:0.35rem;">{{a['description']}}</div>
                <div style="font-size:0.75rem; color:#38bdf8; margin-top:0.4rem; font-weight:600;">접속하기 ➔ /{{a['id']}}/</div>
            </div>
        </a>
        """

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>{server_name} - MQnet</title>
  <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {{ font-family:'Pretendard',sans-serif; background:#0a0f1d; color:#f8fafc; margin:0; padding:2rem 1rem; min-height:100vh; display:flex; justify-content:center; align-items:center; }}
    .container {{ max-width:760px; width:100%; }}
    .header {{ text-align:center; margin-bottom:2.5rem; }}
    .badge {{ display:inline-block; padding:0.35rem 0.85rem; border-radius:20px; font-size:0.8rem; font-weight:700; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); margin-bottom:0.75rem; }}
    .grid {{ display:flex; flex-direction:column; gap:1rem; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">🏛️ 독립 전용 인프라 가동 중</div>
      <h1 style="font-size:1.9rem; font-weight:800; margin:0.3rem 0;">{server_name}</h1>
      <p style="color:#94a3b8; font-size:0.95rem; margin-top:0.5rem;">통합 가동 중인 솔루션 앱을 선택하여 접속하세요.</p>
    </div>
    <div class="grid">
      {{cards_html}}
    </div>
    <div style="text-align:center; margin-top:2.5rem; font-size:0.8rem; color:#64748b;">
      MQnet Modular SaaS Architecture • Powered by Antigravity
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"🚀 {server_name} 기동 중: http://{{host}}:{{port}}")
    uvicorn.run("multi_runner:app", host=host, port=port, reload=False)
'''
        with open(os.path.join(target_dir, "multi_runner.py"), "w", encoding="utf-8") as f:
            f.write(runner_code)

    def _generate_multi_docker(self, target_dir: str, app_infos: List[Dict[str, Any]], server_name: str):
        """다중 앱용 Dockerfile 및 docker-compose.yml 생성"""
        req_content = """fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy>=2.0.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-dotenv>=1.0.0
cryptography>=41.0.0
python-multipart>=0.0.6
aiofiles>=23.2.1
requests>=2.31.0
"""
        with open(os.path.join(target_dir, "requirements.txt"), "w", encoding="utf-8") as f:
            f.write(req_content)

        dockerfile = """FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 RUN_MODE=standalone PORT=8000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /app/data /app/media
VOLUME ["/app/data", "/app/media"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:8000/api/health || exit 1
CMD ["python", "multi_runner.py"]
"""
        with open(os.path.join(target_dir, "Dockerfile"), "w", encoding="utf-8") as f:
            f.write(dockerfile)

        compose = f"""services:
  mqnet-multi:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: mqnet-multi-server
    restart: unless-stopped
    ports:
      - "80:8000"
    environment:
      - RUN_MODE=standalone
      - PORT=8000
      - DEPLOYMENT_MODE=STANDALONE
    volumes:
      - ./data:/app/data
      - ./media:/app/media
"""
        with open(os.path.join(target_dir, "docker-compose.yml"), "w", encoding="utf-8") as f:
            f.write(compose)

    def _generate_multi_scripts(self, target_dir: str, app_infos: List[Dict[str, Any]], server_name: str):
        """다중 앱용 시작/업데이트 스크립트"""
        start_bat = f"""@echo off
chcp 65001 > nul
title {server_name}
echo ========================================================
echo [MQnet] {server_name} 로컬 가동
echo ========================================================
python -m pip install -r requirements.txt
python multi_runner.py
pause
"""
        with open(os.path.join(target_dir, "START_ALL.bat"), "w", encoding="utf-8") as f:
            f.write(start_bat)

        install_sh = f"""#!/bin/bash
echo "========================================================"
echo "🚀 {server_name} 통합 솔루션 자동 설치를 시작합니다"
echo "========================================================"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    sudo systemctl enable --now docker
fi
sudo docker compose down 2>/dev/null || true
sudo docker compose up -d --build
echo "========================================================"
echo "✅ 가동 완료! 웹 브라우저에서 서버 IP로 접속하세요."
echo "========================================================"
"""
        with open(os.path.join(target_dir, "install.sh"), "w", encoding="utf-8", newline="\n") as f:
            f.write(install_sh)

        update_sh = f"""#!/bin/bash
echo "========================================================"
echo "🔄 {server_name} 통합 솔루션 무중단 업데이트"
echo "========================================================"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
if [ -d "./data" ]; then
    mkdir -p ./backups
    tar -czf ./backups/data_backup_$BACKUP_DATE.tar.gz ./data
    echo "🛡️ 데이터 안전 백업 완료: ./backups/data_backup_$BACKUP_DATE.tar.gz"
fi
sudo docker compose up -d --build
echo "========================================================"
echo "✅ 업그레이드 완료 (데이터 100% 보존)"
echo "========================================================"
"""
        with open(os.path.join(target_dir, "update.sh"), "w", encoding="utf-8", newline="\n") as f:
            f.write(update_sh)

    def _generate_quick_guide(self, zip_filename: str, target_platform: str, is_multi: bool, selected_apps: List[str]) -> Dict[str, str]:
        """고객사 배포용 가이드라인 명령어 텍스트 생성"""
        if target_platform == "windows-pc":
            return {
                "title": "🖥️ Windows 로컬 PC 독립 설치 가이드",
                "step1": f"1. 압축 파일({zip_filename})을 원하는 폴더에 압축 해제합니다.",
                "step2": "2. 파이썬 3.10 이상이 설치되어 있는지 확인합니다.",
                "step3": "3. 'START.bat' (또는 'START_ALL.bat')을 더블 클릭하여 실행합니다.",
                "step4": "4. 브라우저에서 http://localhost:8000 에 접속하여 관리자(chicvill / 1212)로 로그인합니다."
            }
        else:
            return {
                "title": "☁️ Linux 클라우드 VM (GCP/AWS) 원클릭 설치 가이드",
                "step1": f"1. 서버 터미널 SSH 창 우측 상단 톱니바퀴 -> [파일 업로드]로 '{zip_filename}'을 업로드합니다.",
                "step2": f"unzip -o ~/{zip_filename} -d ~/mqnet_solution && cd ~/mqnet_solution",
                "step3": "chmod +x install.sh update.sh && ./install.sh",
                "step4": "웹 브라우저에서 http://[서버외부IP]/ 로 접속하여 로그인합니다."
            }

    def list_packages(self) -> List[Dict[str, Any]]:
        """생성된 배포 패키지 목록 조회"""
        packages = []
        if not os.path.exists(DIST_DIR):
            return packages
        for fname in os.listdir(DIST_DIR):
            if fname.endswith(".zip"):
                fpath = os.path.join(DIST_DIR, fname)
                stat = os.stat(fpath)
                packages.append({
                    "filename": fname,
                    "size_bytes": stat.st_size,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                    "download_url": f"/api/deployer/download/{fname}"
                })
        packages.sort(key=lambda x: x["created_at"], reverse=True)
        return packages

    def delete_package(self, filename: str) -> bool:
        """패키지 삭제"""
        safe_name = os.path.basename(filename)
        target = os.path.join(DIST_DIR, safe_name)
        if os.path.exists(target) and target.endswith(".zip"):
            os.remove(target)
            return True
        return False


distro_engine = DistroEngine()
