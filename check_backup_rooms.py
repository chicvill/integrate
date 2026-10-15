import json
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

d = json.load(open('data/chicvill_backup.json', encoding='utf-8'))
rooms = d.get('data', {}).get('rooms', {})
print(f"총 {len(rooms)}개실 정보:")
for k in sorted(rooms.keys(), key=lambda x: int(x)):
    v = rooms[k]
    name = v.get("name") or "(공실)"
    print(f"  [{k}호] {name} (보증금: {v.get('deposit'):,}원, 월세: {v.get('rent'):,}원, 연락처: {v.get('phone')})")
