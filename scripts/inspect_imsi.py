import os
import sys

sys.path.insert(0, "/app")
from apps.rent2.backend.kernel.base import use_store, store
from apps.rent2.backend.domain.rent import Building, Room, Contract, Payment

use_store("/app/apps/rent2/data/rent2.db")
print("=== Buildings in rent2.db ===")
for b in Building.all():
    print(f"ID: {b.id}, Name: {b.name}, Units: {b.units}")

rows = store().db.execute("SELECT key, kind, scope, json_extract(data, '$.name'), json_extract(data, '$.id') FROM objects WHERE kind='building'").fetchall()
print("All Building objects in DB:", [dict(r) for r in rows])

room_rows = store().db.execute("SELECT key, kind, scope, json_extract(data, '$.building_id'), json_extract(data, '$.unit_number'), json_extract(data, '$.tenant_name') FROM objects WHERE kind='room'").fetchall()
print("All Rooms in DB count:", len(room_rows))
for r in room_rows:
    print(dict(r))
