$cmd = 'CID=$(sudo docker ps -q --filter name=gateway | head -n 1); sudo docker inspect $CID | grep -i traefik'
gcloud compute ssh integrated --zone=us-central1-a --command $cmd
