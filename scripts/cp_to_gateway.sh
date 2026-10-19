#!/bin/bash
# usage: cp_to_gateway.sh <file-in-/tmp> <dest-path-in-container> ; restarts nothing (static files)
C=$(sudo docker ps --filter name=gateway -q | head -n1)
sudo docker cp /tmp/$1 $C:$2
echo "copied $1 -> $C:$2"
