import sqlite3, glob, os
from shared.core.base_database import Base, engine
from apps.studycafe.backend.models import PatrolLog, StudyCafeUser, Ticket, Seat

print('1. Creating missing tables...')
Base.metadata.create_all(bind=engine)

db_paths = glob.glob('**/*.db', recursive=True)
print('Found databases:', db_paths)

for p in db_paths:
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    tables = [row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    
    if 'studycafe_users' in tables:
        cols = [row[1] for row in cur.execute("PRAGMA table_info(studycafe_users)").fetchall()]
        print(f'{p} studycafe_users existing cols: {cols}')
        for col_name, col_type in [
            ('birth_date', 'TEXT'),
            ('is_minor', 'INTEGER DEFAULT 0'),
            ('parent_phone', 'TEXT'),
            ('penalty_points', 'INTEGER DEFAULT 0'),
        ]:
            if col_name not in cols:
                print(f'Adding {col_name} to studycafe_users in {p}')
                try:
                    cur.execute(f'ALTER TABLE studycafe_users ADD COLUMN {col_name} {col_type}')
                except Exception as e:
                    print('Error adding col:', e)

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
                    cur.execute(f'ALTER TABLE studycafe_tickets ADD COLUMN {col_name} {col_type}')
                except Exception as e:
                    print('Error adding col:', e)

    conn.commit()
    conn.close()

print('All migrations successfully applied!')
