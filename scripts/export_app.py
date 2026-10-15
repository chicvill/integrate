"""
scripts/export_app.py
MQnet SaaS Standalone App Extractor
중앙 SaaS 모노레포에서 특정 앱을 독립 패키지(전용 클라우드 / 로컬 PC 인트라넷용)로 원클릭 추출합니다.

사용법:
  py scripts/export_app.py --app rent --output dist/rent_standalone --zip
"""
import os
import sys
import shutil
import argparse
import zipfile
import re

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APPS_DIR = os.path.join(PROJECT_ROOT, "apps")
TEMPLATES_DIR = os.path.join(PROJECT_ROOT, "templates", "saas-template")
SHARED_DIR = os.path.join(PROJECT_ROOT, "shared")

APP_METADATA = {
    "rent": {"name": "부동산 원룸 임차료 관리 시스템", "port": 8000, "category": "property"},
    "studycafe": {"name": "무인 스터디카페 관제 시스템", "port": 8001, "category": "space"},
    "kiosk": {"name": "키오스크 무인 결제 시스템", "port": 8002, "category": "pos"},
}

def export_standalone_app(app_id: str, output_dir: str, create_zip: bool = False):
    app_dir = os.path.join(APPS_DIR, app_id)
    if not os.path.exists(app_dir):
        print(f"❌ 오류: 앱 디렉토리를 찾을 수 없습니다: {app_dir}")
        sys.exit(1)

    meta = APP_METADATA.get(app_id, {"name": f"MQnet {app_id.upper()} 솔루션", "port": 8000})
    app_name = meta["name"]
    target_dir = os.path.abspath(output_dir)

    print(f"========================================================")
    print(f"📦 MQnet Standalone App Extractor")
    print(f"• 대상 앱: {app_id} ({app_name})")
    print(f"• 출력 경로: {target_dir}")
    print(f"========================================================")

    # 1. 출력 디렉토리 초기화
    if os.path.exists(target_dir):
        print(f"⚠️ 기존 출력 디렉토리 정리 중: {target_dir}")
        shutil.rmtree(target_dir)
    os.makedirs(target_dir, exist_ok=True)

    # 2. 앱 자체 소스 복사 (frontend, backend, 루트 자산)
    print(f"[1/6] 애플리케이션 소스 복사 중...")
    ignore_patterns = shutil.ignore_patterns(
        "__pycache__", "*.pyc", "*.pyo", ".git*", "node_modules", "*.log", "*.bak*", ".DS_Store"
    )

    # backend 복사
    src_backend = os.path.join(app_dir, "backend")
    if os.path.exists(src_backend):
        shutil.copytree(src_backend, os.path.join(target_dir, "backend"), ignore=ignore_patterns)

    # frontend 복사
    src_frontend = os.path.join(app_dir, "frontend")
    if os.path.exists(src_frontend):
        shutil.copytree(src_frontend, os.path.join(target_dir, "frontend"), ignore=ignore_patterns)

    # 루트 웹 자산 (bundle.js, index.html, manual.html, branches.html 등)
    for fname in os.listdir(app_dir):
        fpath = os.path.join(app_dir, fname)
        if os.path.isfile(fpath) and fname not in ["Dockerfile", "docker-compose.yml"]:
            shutil.copy2(fpath, os.path.join(target_dir, fname))

    # 3. shared 의존성 번들링 (단독 구동을 위한 최소 core)
    print(f"[2/6] 공통 라이브러리(shared) 의존성 번들링 중...")
    target_shared = os.path.join(target_dir, "shared")
    os.makedirs(target_shared, exist_ok=True)
    if os.path.exists(SHARED_DIR):
        src_core = os.path.join(SHARED_DIR, "core")
        if os.path.exists(src_core):
            shutil.copytree(src_core, os.path.join(target_shared, "core"), ignore=ignore_patterns)
        with open(os.path.join(target_shared, "__init__.py"), "w", encoding="utf-8") as f:
            f.write("# MQnet Shared Bundle for Standalone\n")

    # 4. Standalone 템플릿 파일 복사 및 변수 치환
    print(f"[3/6] 단독 구동(Docker/Batch) 패키지 파일 주입 중...")
    replacements = {
        "{{APP_ID}}": app_id,
        "{{APP_NAME}}": app_name,
        "{{PORT}}": str(meta["port"])
    }

    template_files = {
        "Dockerfile.standalone": "Dockerfile",
        "docker-compose.standalone.yml": "docker-compose.yml",
        "standalone_runner.py": "standalone_runner.py",
        "START_STANDALONE.bat": "START.bat",
        "UPDATE_STANDALONE.bat": "UPDATE.bat",
        "requirements.txt": "requirements.txt"
    }

    for tmpl_name, out_name in template_files.items():
        src_file = os.path.join(TEMPLATES_DIR, tmpl_name)
        if os.path.exists(src_file):
            content = open(src_file, "r", encoding="utf-8").read()
            for k, v in replacements.items():
                content = content.replace(k, v)
            dst_file = os.path.join(target_dir, out_name)
            with open(dst_file, "w", encoding="utf-8") as f:
                f.write(content)

    # 5. 데이터 디렉토리 및 안내 README 생성
    print(f"[4/6] 데이터 스토리지 디렉토리 및 배포 안내서 생성 중...")
    os.makedirs(os.path.join(target_dir, "data"), exist_ok=True)
    os.makedirs(os.path.join(target_dir, "media"), exist_ok=True)

    readme_content = f"""# 🚀 {app_name} (독립 실행형 패키지)

본 패키지는 MQnet 중앙 SaaS에서 추출된 **단독 실행형(Standalone) 독립 솔루션**입니다.  
고객 전용 클라우드(GCP, AWS) 또는 관리사무소 로컬 PC/사내 인트라넷에서 100% 독립적으로 구동됩니다.

---

## 💻 1. 관리실 윈도우 PC / 사내 인트라넷에서 실행하기 (폐쇄망)

1. **원클릭 실행**:
   - `START.bat` 파일을 더블클릭합니다.
   - Docker가 설치되어 있으면 Docker 컨테이너로, 없으면 로컬 Python으로 자동 기동 후 브라우저가 열립니다.
2. **사내 네트워크 공유**:
   - 같은 공유기(Wi-Fi)를 사용하는 직원/스마트폰은 `http://<관리실PC_IP>:80`으로 접속하여 관제 가능합니다.
   - **외부 인터넷 연결 없이도 모든 데이터(계약/입금 장부)가 관리실 PC 내(`data/`)에만 100% 안전하게 저장**됩니다.

---

## ☁️ 2. 전용 클라우드 서버(GCP, AWS, 개인 서버)에서 실행하기

```bash
# 1. 압축 해제 후 디렉토리 이동
cd {os.path.basename(target_dir)}

# 2. 도커 컴포즈 1-클릭 백그라운드 가동
docker compose up -d --build

# 3. 서비스 확인
# 브라우저에서 http://<서버공인IP> 로 접속
```

---

## 🔄 3. 데이터 보존 및 업데이트

- **데이터 영구 보존**: 모든 데이터베이스와 첨부파일은 컨테이너 외부 `./data` 폴더에 마운트되므로, 프로그램을 껐다 켜거나 재설치해도 데이터가 절대 유실되지 않습니다.
- **원클릭 업데이트**: 새 프로그램 패키지를 받은 후 `UPDATE.bat`을 더블클릭하면 기존 데이터를 안전하게 유지한 채 10초 만에 최신 기능으로 갱신됩니다.
"""
    with open(os.path.join(target_dir, "README.md"), "w", encoding="utf-8") as f:
        f.write(readme_content)

    # 6. ZIP 압축 생성 (옵션)
    if create_zip:
        zip_path = f"{target_dir}.zip"
        print(f"[5/6] 납품용 압축 패키지 생성 중: {zip_path}")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(target_dir):
                for file in files:
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, target_dir)
                    zf.write(full_p, rel_p)
        print(f"[6/6] 압축 완료! ({os.path.getsize(zip_path)} bytes)")

    print(f"\n✅ 단독 솔루션 패키지 추출이 완료되었습니다!")
    print(f"👉 디렉토리: {target_dir}")
    if create_zip:
        print(f"👉 배포용 ZIP 파일: {target_dir}.zip")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MQnet Standalone App Extractor")
    parser.add_argument("--app", required=True, help="추출 대상 앱 ID (예: rent, studycafe)")
    parser.add_argument("--output", default="", help="출력 디렉토리 경로 (기본값: dist/{app}_standalone)")
    parser.add_argument("--zip", action="store_true", help="추출 완료 후 .zip 압축 파일 생성")

    args = parser.parse_args()
    out_dir = args.output or os.path.join(PROJECT_ROOT, "dist", f"{args.app}_standalone")
    export_standalone_app(args.app, out_dir, create_zip=args.zip)
