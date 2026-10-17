import json

with open('apps/rent/backend/seed_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

rooms = data.get('data', {}).get('rooms', {})
print(f"Total rooms: {len(rooms)}")
for rnum in sorted(rooms.keys(), key=int):
    r = rooms[rnum]
    pay10 = r.get('payments', {}).get('2026-10', r.get('payments', {}).get('10', {}))
    is_paid = pay10.get('paid', False)
    dep = (r.get('deposit') or 0) // 10000
    rent = (r.get('rent') or 0) // 10000
    maint = (r.get('maintenance') or 0) // 10000
    print(f"{rnum}호: {r.get('name')} | {r.get('lease_type')}/{r.get('pay_timing')} | 보:{dep}만 월:{rent}만 관:{maint}만 | 10월:{'완납' if is_paid else '미납'} | 만기:{r.get('expiry')}")
