#!/bin/bash
C=$(sudo docker ps --filter name=gateway -q | head -n1)
sudo docker exec $C find /app/apps/rent /app/gateway -name "bundle.js" -o -name "index.html" 2>/dev/null | grep -i rent
echo "container: $C"
