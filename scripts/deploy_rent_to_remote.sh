#!/bin/bash
set -e
CID=$(sudo docker ps -qf "name=gateway" | head -n 1)
echo "Target Container: $CID"
sudo docker cp /home/USER/bundle.js "${CID}:/app/apps/rent/bundle.js"
sudo docker cp /home/USER/index.html "${CID}:/app/apps/rent/index.html"
sudo docker cp /home/USER/branch_service.py "${CID}:/app/apps/rent/backend/services/branch_service.py"
sudo docker restart "$CID"
echo "Deploy completed successfully!"
