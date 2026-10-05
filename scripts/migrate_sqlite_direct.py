import sqlite3, glob, os

db_files = ['integrat.db']
db_files.extend(glob.glob('**/*.db', recursive=True))
# Remove duplicates
db_files = list(set(db_files))
print('Target DB files:', db_files)

for p in db_files:
    if not os.path.exists(p):
        continue
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    tables = [row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print(f'Checking {p}: tables = {tables}')
    
    if 'studycafe_seats' in tables:
        cols = [row[1] for row in cur.execute("PRAGMA table_info(studycafe_seats)").fetchall()]
        print(f'{p} studycafe_seats existing cols: {cols}')
        for col_name, col_type in [
            ('step_out_at', 'DATETIME'),
        ]:
            if col_name not in cols:
                print(f'Adding {col_name} to studycafe_seats in {p}')
                try:
                    cur.execute(f"ALTER TABLE studycafe_seats ADD COLUMN {col_name} {col_type}")
                except Exception as e:
                    print('Error adding col to studycafe_seats:', e)

    if 'studycafe_users' in tables:
        cols = [row[1] for row in cur.execute("PRAGMA table_info(studycafe_users)").fetchall()]
        print(f'{p} studycafe_users existing cols: {cols}')
        for col_name, col_type in [
            ('birth_date', 'TEXT'),
            ('is_minor', 'INTEGER DEFAULT 0'),
            ('night_exempt', 'INTEGER DEFAULT 0'),
            ('parent_phone', 'TEXT'),
            ('penalty_points', 'INTEGER DEFAULT 0'),
        ]:
            if col_name not in cols:
                print(f'Adding {col_name} to studycafe_users in {p}')
                try:
                    cur.execute(f"ALTER TABLE studycafe_users ADD COLUMN {col_name} {col_type}")
                except Exception as e:
                    print('Error adding col to studycafe_users:', e)

    if 'studycafe_tickets' in tables:
        cols = [row[1] for row in cur.execute("PRAGMA table_info(studycafe_tickets)").fetchall()]
        print(f'{p} studycafe_tickets existing cols: {cols}')
        for col_name, col_type in [
            ('is_held', 'INTEGER DEFAULT 0'),
            ('hold_started_at', 'TEXT'),
            ('hold_count', 'INTEGER DEFAULT 0'),
            ('hold_total_days', 'INTEGER DEFAULT 0'),
        ]:
            if col_name not in cols:
                print(f'Adding {col_name} to studycafe_tickets in {p}')
                try:
                    cur.execute(f"ALTER TABLE studycafe_tickets ADD COLUMN {col_name} {col_type}")
                except Exception as e:
                    print('Error adding col to studycafe_tickets:', e)

    # Create studycafe_patrol_logs table if not exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS studycafe_patrol_logs (
            id VARCHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(100) NOT NULL,
            seat_number VARCHAR(20) NOT NULL,
            user_id VARCHAR(36),
            user_name VARCHAR(100),
            user_phone VARCHAR(50),
            category VARCHAR(50) NOT NULL,
            penalty INTEGER DEFAULT 0,
            note VARCHAR(200),
            manager_name VARCHAR(50) DEFAULT '관리실장',
            created_at DATETIME,
            updated_at DATETIME
        )
    """)
    conn.commit()
    conn.close()

print('Direct SQLite schema migrations finished successfully!')
