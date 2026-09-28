#!/usr/bin/env python3
"""
MQnet SaaS Generator (@mqnet/create-app)
Automatically scaffolds a new full-stack SaaS service inheriting from BaseConfig/BaseApp
with standardized Vite React frontend and @mqnet/ui integration.

Usage:
    python scripts/create_app.py --id petcare --name "스마트 펫케어" --icon "🐾" --category "iot" --port 9015
"""
import os
import sys
import shutil
import argparse

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATE_DIR = os.path.join(ROOT_DIR, "templates", "saas-template")

def scaffold_app(app_id: str, app_name: str, app_icon: str, app_category: str, port: int):
    target_dir = os.path.join(ROOT_DIR, "apps", app_id)
    if os.path.exists(target_dir):
        print(f"❌ Error: App directory already exists: {target_dir}")
        sys.exit(1)

    print(f"🚀 Scaffolding new SaaS service: {app_name} ({app_id})...")
    shutil.copytree(TEMPLATE_DIR, target_dir)

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

    print(f"✅ App created at: {target_dir}")
    print(f"👉 Next steps:")
    print(f"   1. cd apps/{app_id}/frontend && npm install && npm run build")
    print(f"   2. Service ready at http://localhost:{port} and https://chicvill.store/{app_id}/")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a new MQnet SaaS service")
    parser.add_argument("--id", required=True, help="App ID in lowercase alphanumeric (e.g., petcare)")
    parser.add_argument("--name", required=True, help="App Display Name (e.g., '스마트 펫케어')")
    parser.add_argument("--icon", default="✨", help="App Emoji Icon")
    parser.add_argument("--category", default="utility", help="App Category (business, education, iot, media, utility)")
    parser.add_argument("--port", type=int, default=9015, help="Backend Port")
    args = parser.parse_args()

    scaffold_app(args.id, args.name, args.icon, args.category, args.port)
