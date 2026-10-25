#!/bin/bash
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
sudo docker cp /tmp/inspect_imsi.py "$CID:/tmp/inspect_imsi.py"
sudo docker exec "$CID" python /tmp/inspect_imsi.py
