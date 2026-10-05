#!/bin/bash
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Gateway Container: $CID"

mkdir -p /tmp/sc_patch
tar -xzf ~/studycafe_patch.tar.gz -C /tmp/sc_patch

sudo docker cp /tmp/sc_patch/. "${CID}:/app/apps/studycafe/frontend/"
rm -rf /tmp/sc_patch ~/studycafe_patch.tar.gz

echo "Successfully deployed studycafe patch to $CID!"
