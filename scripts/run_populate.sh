#!/bin/bash
set -e
CID=$(docker ps -qf "name=gateway" | head -n 1)
echo "Container: $CID"
docker cp /home/USER/populate_2025.py "${CID}:/app/populate_2025.py"
docker exec "${CID}" python3 /app/populate_2025.py
