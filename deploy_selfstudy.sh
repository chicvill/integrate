#!/bin/bash
set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
echo "Target Gateway Container: $CID"

mkdir -p /tmp/ss_patch
tar -xzf ~/selfstudy_patch.tar.gz -C /tmp/ss_patch

sudo docker cp /tmp/ss_patch/app.js "$CID:/app/apps/selfstudy/frontend/app.js"
sudo docker cp /tmp/ss_patch/style.css "$CID:/app/apps/selfstudy/frontend/style.css"
sudo docker cp /tmp/ss_patch/js/. "$CID:/app/apps/selfstudy/frontend/js/"

echo "Successfully deployed to gateway container $CID!"
