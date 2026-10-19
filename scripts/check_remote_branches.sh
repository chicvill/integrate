CID=$(sudo docker ps -qf "name=gateway" | head -n 1)
sudo docker exec $CID python3 -c "import sqlite3; conn=sqlite3.connect('/app/integrat.db'); c=conn.cursor(); print(c.execute('SELECT branch_id, name FROM rent_branches').fetchall())"
