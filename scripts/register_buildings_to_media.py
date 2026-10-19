import sqlite3, uuid
from datetime import datetime

for p in ['/media/integrat.db', '/app/integrat.db']:
    try:
        conn = sqlite3.connect(p)
        cur = conn.cursor()
        
        # Check existing branches
        existing = {row[0]: row[1] for row in cur.execute("SELECT branch_id, name FROM rent_branches").fetchall()}
        print(f"{p} before: {existing}")
        
        now = datetime.now().isoformat()
        
        # 1. 신비주택
        if not any('신비' in name for name in existing.values()):
            b_id = 'branch_9348'
            uid = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO rent_branches (id, branch_id, name, contact_phone, address, fee_plan, monthly_fee, billing_due_day, billing_status, is_active, metadata_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (uid, b_id, '신비주택', '010-1234-5678', '서울특별시 영등포구 신길동 123-45', '원룸 프리미엄 20실형', 150000, 25, 'PAID', 1, '{}', now, now))
            print(f"Added 신비주택 to {p}")
            
        # 2. 선호빌
        if not any('선호' in name for name in existing.values()):
            b_id = 'branch_5611'
            uid = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO rent_branches (id, branch_id, name, contact_phone, address, fee_plan, monthly_fee, billing_due_day, billing_status, is_active, metadata_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (uid, b_id, '선호빌', '010-9876-5432', '서울특별시 마포구 서교동 456-78', '원룸 프리미엄 20실형', 150000, 25, 'PAID', 1, '{}', now, now))
            print(f"Added 선호빌 to {p}")
            
        conn.commit()
        after = {row[0]: row[1] for row in cur.execute("SELECT branch_id, name FROM rent_branches").fetchall()}
        print(f"{p} after: {after}")
        conn.close()
    except Exception as e:
        print(f"Error on {p}: {e}")
