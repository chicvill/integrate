#!/bin/bash
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Current gateway CID: $CID"
sudo docker inspect "$CID" --format '{{json .Mounts}}'
echo ""
sudo docker exec "$CID" ls -la /media /app/data ./
