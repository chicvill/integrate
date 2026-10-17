CID=$(sudo docker ps -q --filter name=gateway | head -n 1)
sudo docker exec $CID sqlite3 /app/integrat.db "SELECT id, branch_id, room_number, year, month, paid, paid_date, note FROM rent_payments WHERE room_number=302;"
