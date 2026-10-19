import sqlite3, os

for p in ['/media/integrat.db', '/app/integrat.db']:
    try:
        conn = sqlite3.connect(p)
        tables = [t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        print(f"=== {p} (size: {os.path.getsize(p)}) ===")
        print(f"Tables: {len(tables)} tables")
        if 'rent_branches' in tables:
            branches = conn.execute("select branch_id, name from rent_branches").fetchall()
            print(f"Branches: {branches}")
        if 'rent_rooms' in tables:
            rooms = conn.execute("select count(*), branch_id from rent_rooms group by branch_id").fetchall()
            print(f"Rooms by branch: {rooms}")
    except Exception as e:
        print(f"{p} error: {e}")
