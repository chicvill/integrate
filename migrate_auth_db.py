import sqlite3
import os

db_path = '/media/integrat.db'
if not os.path.exists(db_path):
    db_path = './integrat.db'

print(f"Connecting to {db_path}...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(users)").fetchall()]
print("Existing columns:", existing_cols)

cols_to_add = [
    ("auth_provider", "TEXT DEFAULT 'local'"),
    ("allowed_apps", "TEXT DEFAULT '[\"*\"]'"),
    ("app_roles", "TEXT DEFAULT '{}'"),
]

for col_name, col_type in cols_to_add:
    if col_name not in existing_cols:
        sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type};"
        print(f"Executing: {sql}")
        cursor.execute(sql)
    else:
        print(f"Column {col_name} already exists.")

conn.commit()
conn.close()
print("Migration complete!")
