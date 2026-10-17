gcloud compute scp query_db.py integrated:/tmp/query_db.py --zone=us-central1-a
$cmd = 'CID=$(sudo docker ps -q --filter name=gateway | head -n 1); sudo docker cp /tmp/query_db.py ${CID}:/tmp/query_db.py; sudo docker exec ${CID} python /tmp/query_db.py'
gcloud compute ssh integrated --zone=us-central1-a --command=$cmd
