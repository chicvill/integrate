#!/bin/bash
set -e
tar -xzf /home/USER/files_dist.tar.gz -C /home/USER/
CID=$(sudo docker ps --filter name=gateway --format '{{.ID}}')
echo "Gateway container ID: $CID"
sudo docker cp /home/USER/apps/files/. "$CID:/app/apps/files/"
echo "Restarting gateway container..."
sudo docker restart "$CID"
rm -f /home/USER/files_dist.tar.gz
echo "DEPLOY_COMPLETE_SUCCESS"
