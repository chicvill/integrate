import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    getattr(sys.stdout, "reconfigure")(encoding="utf-8")
with open('data/chicvill_backup.json', encoding='utf-8') as f:
    d = json.load(f)['data']

for rk in ['404', '405', '503', '505', '703']:
    if rk in d['rooms']:
        r = d['rooms'][rk]
        print(f"Room {rk}: name={r.get('name')} move_in={r.get('move_in')} pay_timing={r.get('pay_timing')}")
        for th in r.get('tenant_histories', []):
            print(f"  th: name={th.get('name')} move_in={th.get('move_in')} move_out={th.get('move_out')}")
