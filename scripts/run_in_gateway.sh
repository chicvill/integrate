#!/bin/bash
# usage: run_in_gateway.sh <local-py-in-/tmp> [args...]
C=$(sudo docker ps --filter name=gateway -q | head -n1)
F=$1; shift
sudo docker cp /tmp/$F $C:/tmp/$F
sudo docker exec $C python3 /tmp/$F "$@"
