#!/bin/bash
set -e

CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Container: $CID"

sudo docker cp /tmp/auth_service.py "${CID}:/app/apps/rent/backend/services/auth_service.py"
sudo docker cp /tmp/bundle.js "${CID}:/app/apps/rent/frontend/bundle.js"
sudo docker cp /tmp/bundle.js "${CID}:/app/apps/rent/bundle.js"
sudo docker cp /tmp/seed_rent_users.py "${CID}:/app/seed_users.py"

echo "Executing user seeding inside container..."
sudo docker exec -w /app "${CID}" python /app/seed_users.py

echo "Restarting container..."
sudo docker restart "${CID}"
echo "Deploy completed successfully!"
