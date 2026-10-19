import sqlite3
import os
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else '/media/integrat.db'
conn = sqlite3.connect(db_path)
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print(f"Tables in {db_path}:", tables)
for t in tables:
    if 'user' in t:
        count = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  {t}: {count} rows")
