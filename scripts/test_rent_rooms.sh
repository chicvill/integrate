#!/bin/bash
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
sudo docker exec "$CID" python -c "
import traceback
try:
    from apps.rent.backend.db import SessionLocal
    from apps.rent.backend.services.rent_service import service
    db = SessionLocal()
    print('Testing service.get_rooms...')
    res = service.get_rooms(db, 'main')
    print('ROOMS COUNT:', len(res))
except Exception as e:
    traceback.print_exc()
"
