set -e
CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
if [ -z "$CID" ]; then
    CID=$(sudo docker ps -aq --filter name=gateway | head -n 1)
fi
echo "?? ??????????????????: $CID"

# ??? ??? ?????? ????????? ???
rm -rf /tmp/gcp_patch
mkdir -p /tmp/gcp_patch
tar -xzf gcp_update.tar.gz -C /tmp/gcp_patch

# ??? DB ???: ??? ??????????? ?????? .db ??? ??? ???
find /tmp/gcp_patch -name "*.db" -type f -delete 2>/dev/null || true

# ?????? ??? ??????????? ???
sudo docker exec $CID mkdir -p /app/apps/rent/data /app/apps/rent2/data /app/apps/studycafe2/data /app/apps/selfstudy2/data

# ??? ??? ?????? ????????
sudo docker cp /tmp/gcp_patch/apps/rent $CID:/app/apps/
sudo docker cp /tmp/gcp_patch/apps/rent2 $CID:/app/apps/
sudo docker cp /tmp/gcp_patch/apps/studycafe2 $CID:/app/apps/
sudo docker cp /tmp/gcp_patch/apps/selfstudy2 $CID:/app/apps/
sudo docker cp /tmp/gcp_patch/shared $CID:/app/
sudo docker cp /tmp/gcp_patch/templates/saas-template $CID:/app/templates/
sudo docker cp /tmp/gcp_patch/gateway $CID:/app/

# ??? ??? ???
rm -rf /tmp/gcp_patch gcp_update.tar.gz

echo "?? ?????? ???????.."
sudo docker restart $CID
sleep 5

echo "?? ??? ?????? ??? ???:"
sudo docker logs $CID --tail 30

echo "?? ??? ?????? ????"
HTTP_PORTAL=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/ || echo "FAIL")
HTTP_RENT2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/rent2/ || echo "FAIL")
HTTP_RENT_ALIAS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/rent/ || echo "FAIL")
HTTP_API_RENT2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/api/rent2/buildings || echo "FAIL")
HTTP_STUDY2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/studycafe2/ || echo "FAIL")
HTTP_SELF2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9000/selfstudy2/ || echo "FAIL")

echo "??? ??? -> ???: $HTTP_PORTAL | rent2: $HTTP_RENT2 | rent(???): $HTTP_RENT_ALIAS | api/rent2: $HTTP_API_RENT2 | studycafe2: $HTTP_STUDY2 | selfstudy2: $HTTP_SELF2"