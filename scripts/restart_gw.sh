#!/bin/bash
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
sudo docker restart "$CID"
echo "RESTARTED"
