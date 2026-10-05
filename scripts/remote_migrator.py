import sqlite3

db_paths = [
    '/data/coolify/applications/o58s2caega68fkuxpff0pubf/media/integrat.db',
    '/media/integrat.db',
    'integrat.db'
]

for db_path in db_paths:
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # 1. studycafe_seats
        cols = [r[1] for r in cur.execute('PRAGMA table_info(studycafe_seats)').fetchall()]
        print(f'{db_path} Seats cols before:', cols)
        if cols and 'step_out_at' not in cols:
            cur.execute('ALTER TABLE studycafe_seats ADD COLUMN step_out_at DATETIME')
            print(f'Added step_out_at to studycafe_seats in {db_path}')

        # 2. studycafe_users
        cols_u = [r[1] for r in cur.execute('PRAGMA table_info(studycafe_users)').fetchall()]
        print(f'{db_path} Users cols before:', cols_u)
        for col, col_t in [
            ('birth_date', 'TEXT'),
            ('is_minor', 'INTEGER DEFAULT 0'),
            ('night_exempt', 'INTEGER DEFAULT 0'),
            ('parent_phone', 'TEXT'),
            ('penalty_points', 'INTEGER DEFAULT 0'),
        ]:
            if cols_u and col not in cols_u:
                cur.execute(f'ALTER TABLE studycafe_users ADD COLUMN {col} {col_t}')
                print(f'Added {col} to studycafe_users in {db_path}')

        # 3. studycafe_tickets
        cols_t = [r[1] for r in cur.execute('PRAGMA table_info(studycafe_tickets)').fetchall()]
        print(f'{db_path} Tickets cols before:', cols_t)
        for col, col_t in [
            ('is_held', 'INTEGER DEFAULT 0'),
            ('hold_started_at', 'TEXT'),
            ('hold_count', 'INTEGER DEFAULT 0'),
            ('hold_total_days', 'INTEGER DEFAULT 0'),
        ]:
            if cols_t and col not in cols_t:
                cur.execute(f'ALTER TABLE studycafe_tickets ADD COLUMN {col} {col_t}')
                print(f'Added {col} to studycafe_tickets in {db_path}')

        # 4. studycafe_patrol_logs table
        cur.execute('''
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
        ''')
        print(f'Ensured studycafe_patrol_logs table exists in {db_path}')

        conn.commit()
        conn.close()
        print(f'SUCCESS migration on {db_path}')
    except Exception as e:
        print(f'Skipping/Error on {db_path}: {e}')
