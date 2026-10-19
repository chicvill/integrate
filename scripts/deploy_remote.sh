#!/bin/bash
set -e
CID=$(docker ps -qf "name=gateway" | head -n 1)
echo "Target Container: $CID"
mkdir -p /home/USER/rent_extracted
tar -xzf /home/USER/rent_update.tar.gz -C /home/USER/rent_extracted
docker cp /home/USER/rent_extracted/. "${CID}:/app/apps/rent/"
docker restart "$CID"
echo "Deploy completed successfully!"
