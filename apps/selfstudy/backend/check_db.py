import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import DatabaseManager

def check():
    db = DatabaseManager()
    with db.connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT user_id, name, password FROM study_users")
        for r in cur.fetchall():
            print(r)

if __name__ == "__main__":
    check()
