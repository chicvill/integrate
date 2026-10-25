#!/bin/bash
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
sudo docker logs --tail 80 "$CID"
