"""
scripts/update_seed_data_js.py
data/chicvill_backup.json을 기반으로 apps/rent/frontend/js/seed_data.js를 최신화합니다.
"""
import os
import json

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKUP_PATH = os.path.join(PROJECT_ROOT, "data", "chicvill_backup.json")
SEED_JS_PATH = os.path.join(PROJECT_ROOT, "apps", "rent", "frontend", "js", "seed_data.js")

def update_seed_js():
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    rooms_list = data.get("rooms", [])
    rooms_dict = {}
    for r in rooms_list:
        rn = str(r.get("room_number") or r.get("number"))
        rooms_dict[rn] = r

    js_content = "/**\n" \
                 " * apps/rent/frontend/js/seed_data.js\n" \
                 " * 29개실 표준 공인 장부 시드 데이터 (구글 시트 2025.12 ~ 2026.10 완벽 동기화)\n" \
                 " */\n" \
                 f"export const CANONICAL_ROOMS_DATA = {json.dumps(rooms_dict, ensure_ascii=False, indent=2)};\n"

    with open(SEED_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Updated {SEED_JS_PATH} with {len(rooms_dict)} rooms.")

if __name__ == "__main__":
    update_seed_js()
