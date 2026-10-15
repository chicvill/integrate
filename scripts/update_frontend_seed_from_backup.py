"""
scripts/update_frontend_seed_from_backup.py
시크빌 백업 JSON의 29개실 공식 데이터를 apps/rent/frontend/js/state.js의
generateDefaultSeedRooms() 기본 시드 데이터로 완벽 주입합니다.
"""
import os
import sys
import json
import re

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
JSON_PATH = os.path.join(PROJECT_ROOT, "data", "chicvill_backup.json")
STATE_JS_PATH = os.path.join(PROJECT_ROOT, "apps", "rent", "frontend", "js", "state.js")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    backup_data = json.load(f)

rooms_data = backup_data.get("data", {}).get("rooms", {})

# state.js 읽기
with open(STATE_JS_PATH, "r", encoding="utf-8") as f:
    state_content = f.read()

# JSON 데이터를 JS 객체 리터럴 형태로 변환
rooms_json_str = json.dumps(rooms_data, ensure_ascii=False, indent=2)

new_func = f"""export function generateDefaultSeedRooms() {{
  const SEED_BACKUP_ROOMS = {rooms_json_str};
  const res = {{}};
  
  Object.keys(SEED_BACKUP_ROOMS).forEach(rKey => {{
    const r = SEED_BACKUP_ROOMS[rKey];
    const rNum = parseInt(rKey, 10);
    res[rNum] = {{
      room_number: rNum,
      branch_id: r.branch_id || 'main',
      name: r.name || '',
      id_number: r.id_number || '',
      phone: r.phone || '',
      lease_type: r.lease_type || '월세',
      pay_timing: r.pay_timing || '후불',
      deposit: r.deposit || 0,
      rent: r.rent || 0,
      maintenance: r.maintenance || 0,
      clean_fee: r.clean_fee || 0,
      move_in: r.move_in || '',
      expiry: r.expiry || '',
      move_out: r.move_out || '',
      auto_renewed: r.auto_renewed || false,
      payments: r.payments || {{}},
      tenant_histories: r.tenant_histories || []
    }};
  }});
  return res;
}}"""

# generateDefaultSeedRooms() 함수 치환
pattern = r"export function generateDefaultSeedRooms\(\) \{[\s\S]*?\n  return res;\n\}"
if re.search(pattern, state_content):
    updated_content = re.sub(pattern, new_func, state_content, count=1)
    with open(STATE_JS_PATH, "w", encoding="utf-8") as f:
        f.write(updated_content)
    print("✅ apps/rent/frontend/js/state.js 기본 시드 데이터 갱신 완료!")
else:
    print("❌ 패턴 매칭 실패")
    sys.exit(1)
