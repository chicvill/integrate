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
from typing import Optional, Dict, Any

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATE_DIR = os.path.join(ROOT_DIR, "templates", "saas-template")

# 15대 표준 SaaS 프리셋 기본값 정의
SAAS_PRESETS: Dict[str, Dict[str, Any]] = {
    "studycafe": {"app_name": "스터디카페 관리", "icon": "☕", "category": "business", "port": 9002},
    "store": {"app_name": "매장 QR 주문 & POS", "icon": "🍽️", "category": "business", "port": 9004},
    "selfstudy": {"app_name": "자기주도학습 관리", "icon": "📚", "category": "education", "port": 9003},
    "smartfarm": {"app_name": "스마트팜 센서 관제", "icon": "🌿", "category": "iot", "port": 9005},
    "photos": {"app_name": "스마트 갤러리", "icon": "📸", "category": "media", "port": 9006},
    "ytdownloader": {"app_name": "유튜브 미디어 다운로더", "icon": "🎬", "category": "media", "port": 9008},
    "ai_gwansang": {"app_name": "AI 관상 분석", "icon": "🔮", "category": "ai_vision", "port": 9009},
    "face_analy": {"app_name": "테토/에겐 AI 얼굴 분석", "icon": "🧑‍🎨", "category": "ai_vision", "port": 9010},
    "clock": {"app_name": "모던 스마트 클락", "icon": "⏰", "category": "utility", "port": 9012},
    "videobooth": {"app_name": "레트로 TV 비디오 부스", "icon": "📺", "category": "media", "port": 9013},
    "grammer": {"app_name": "Grammar Quest", "icon": "🔤", "category": "education", "port": 9014},
    "petcare": {"app_name": "스마트 펫케어", "icon": "🐾", "category": "iot", "port": 9015},
}

def get_preset(preset_id: str) -> Dict[str, Any]:
    return SAAS_PRESETS.get(preset_id, {})


def scaffold_app(app_id: str, app_name: str, app_icon: str, app_category: str, port: int, preset_id: Optional[str] = None):
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

    # Ensure app root package __init__.py exists
    app_init_py = os.path.join(target_dir, "__init__.py")
    if not os.path.exists(app_init_py):
        with open(app_init_py, "w", encoding="utf-8") as f:
            f.write(f'"""MQnet {app_name} [{app_id}] Application Package"""\n')

    print(f"✅ App successfully created at: {target_dir}")
    print(f"\n👉 Next steps to launch:")
    print(f"   1. Zero Build Step Frontend:")
    print(f"      No build step required! (Pure bundleless ES modules & Vanilla CSS)")
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
