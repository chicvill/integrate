#!/usr/bin/env python3
"""
scripts/create_app.py
MQnet Smart SaaS Generator (@mqnet/create-app)
15대 표준 SaaS 아키타입 프리셋을 기반으로 고성능 독립 SaaS 서비스를 1초 만에 자동 생성(스캐폴딩)합니다.

사용 예시:
    # 1. 15대 표준 프리셋 지정 생성:
    python scripts/create_app.py --preset studycafe --id my_cafe --name "메가 스터디카페"
    python scripts/create_app.py --preset smartfarm --id my_farm --name "스마트 수직농장"

    # 2. 커스텀 독립 SaaS 생성:
    python scripts/create_app.py --id petcare --name "스마트 펫케어" --icon "🐾" --category "iot" --port 9015
"""
import os
import sys
import shutil
import argparse

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATE_DIR = os.path.join(ROOT_DIR, "templates", "saas-template")

# 프리셋 모듈 임포트
sys.path.insert(0, ROOT_DIR)
try:
    from templates.saas_template.backend.presets import SAAS_PRESETS, get_preset
except ImportError:
    try:
        import runpy
        p_mod = runpy.run_path(os.path.join(TEMPLATE_DIR, "backend", "presets.py"))
        SAAS_PRESETS = p_mod["SAAS_PRESETS"]
        get_preset = p_mod["get_preset"]
    except Exception:
        SAAS_PRESETS = {}
        get_preset = lambda x: {}


def scaffold_app(app_id: str, app_name: str, app_icon: str, app_category: str, port: int, preset_id: str = None):
    target_dir = os.path.join(ROOT_DIR, "apps", app_id)
    if os.path.exists(target_dir):
        print(f"❌ Error: App directory already exists: {target_dir}")
        sys.exit(1)

    print(f"\n=======================================================")
    print(f"🚀 MQnet Smart SaaS Scaffolder")
    print(f"   Service: {app_name} [{app_id}]")
    print(f"   Icon: {app_icon} | Category: {app_category} | Port: {port}")
    if preset_id:
        print(f"   Base Archetype Preset: {preset_id}")
    print(f"=======================================================\n")

    print(f"📦 Copying templates from {TEMPLATE_DIR}...")
    shutil.copytree(
        TEMPLATE_DIR,
        target_dir,
        ignore=shutil.ignore_patterns("node_modules", "dist", ".git", "__pycache__", "*.pyc")
    )

    # Replacements
    replacements = {
        "{{APP_ID}}": app_id,
        "{{APP_NAME}}": app_name,
        "{{APP_ICON}}": app_icon,
        "{{APP_CATEGORY}}": app_category,
        "{{APP_PORT}}": str(port),
    }

    # Walk and replace placeholders
    for root, _, files in os.walk(target_dir):
        for f in files:
            file_path = os.path.join(root, f)
            try:
                with open(file_path, "r", encoding="utf-8") as rf:
                    content = rf.read()
                for placeholder, val in replacements.items():
                    content = content.replace(placeholder, val)
                with open(file_path, "w", encoding="utf-8") as wf:
                    wf.write(content)
            except Exception:
                pass

    print(f"✅ App successfully created at: {target_dir}")
    print(f"\n👉 Next steps to launch:")
    print(f"   1. Frontend Build:")
    print(f"      cd apps/{app_id}/frontend && npm install && npm run build")
    print(f"   2. Run Backend Standalone:")
    print(f"      python -m uvicorn apps.{app_id}.backend.main:app --port {port} --reload")
    print(f"   3. Or Access Unified Gateway:")
    print(f"      http://localhost:9000/{app_id} (or https://chicvill.store/{app_id}/)")
    print(f"=======================================================\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a new MQnet SaaS service")
    parser.add_argument("--preset", help="15 Base SaaS Archetype (e.g., studycafe, store, smartfarm, ai_gwansang, ...)")
    parser.add_argument("--id", help="App ID in lowercase alphanumeric (e.g., petcare)")
    parser.add_argument("--name", help="App Display Name (e.g., '스마트 펫케어')")
    parser.add_argument("--icon", help="App Emoji Icon")
    parser.add_argument("--category", help="App Category (business, education, iot, media, utility, ai_vision, game)")
    parser.add_argument("--port", type=int, help="Backend Port")
    args = parser.parse_args()

    # 프리셋 기반 기본값 자동 보정
    preset_data = {}
    if args.preset:
        preset_data = get_preset(args.preset)
        if not preset_data:
            print(f"⚠️ Warning: Preset '{args.preset}' not found. Using default.")

    app_id = args.id or (f"{args.preset}_service" if args.preset else None)
    if not app_id:
        print("❌ Error: --id or --preset is required.")
        sys.exit(1)

    app_name = args.name or preset_data.get("app_name", f"{app_id.capitalize()} Service")
    app_icon = args.icon or preset_data.get("icon", "✨")
    app_category = args.category or preset_data.get("category", "utility")
    port = args.port or preset_data.get("port", 9015)

    scaffold_app(app_id, app_name, app_icon, app_category, port, args.preset)
