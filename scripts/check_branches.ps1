$cmd = 'sudo sqlite3 /media/integrat.db "SELECT branch_id, name FROM rent_branches;"'
gcloud compute ssh integrated --zone=us-central1-a --command "$cmd"
