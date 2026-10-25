#!/bin/bash
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
sudo docker cp /tmp/apply_imsi_batch.py "$CID:/tmp/apply_imsi_batch.py"
sudo docker exec "$CID" python /tmp/apply_imsi_batch.py
echo "ALL_APPLIED_SUCCESSFULLY"
