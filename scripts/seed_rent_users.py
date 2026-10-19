"""
scripts/seed_rent_users.py
시크빌(chic), 선호빌(sunho), 신비주택(sinbi) 점주 계정을 DB에 즉시 등록 및 동기화하는 스크립트.
"""
import sqlite3
import uuid
import sys
import os

DB_PATH: str | None = sys.argv[1] if len(sys.argv) > 1 else None
if not DB_PATH:
    for cand in ['/media/integrat.db', '/app/data/rent.db', 'apps/rent/backend/rent.db', 'rent.db']:
        if os.path.exists(cand):
            DB_PATH = cand
            break

if not DB_PATH:
    sys.exit("❌ DB 파일을 찾을 수 없습니다.")

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

users = [
    {
        "username": "chic",
        "password": "1212",
        "name": "시크빌 점주",
        "phone": "010-1234-5678",
        "role": "branch_admin",
        "assigned_branch_id": "main",
        "status": "APPROVED",
        "reason": "시크빌 전용 점주 계정"
    },
    {
        "username": "sunho",
        "password": "1212",
        "name": "선호빌 점주",
        "phone": "010-7250-7800",
        "role": "branch_admin",
        "assigned_branch_id": "branch_5611",
        "status": "APPROVED",
        "reason": "선호빌 전용 점주 계정"
    },
    {
        "username": "sinbi",
        "password": "1212",
        "name": "신비주택 점주",
        "phone": "010-4281-6453",
        "role": "branch_admin",
        "assigned_branch_id": "branch_9348",
        "status": "APPROVED",
        "reason": "신비주택 전용 점주 계정"
    }
]

for u in users:
    c.execute("SELECT id FROM rent_users WHERE username=?", (u["username"],))
    row = c.fetchone()
    if row:
        c.execute("""
            UPDATE rent_users
            SET password=?, name=?, phone=?, role=?, assigned_branch_id=?, status=?, reason=?
            WHERE username=?
        """, (u["password"], u["name"], u["phone"], u["role"], u["assigned_branch_id"], u["status"], u["reason"], u["username"]))
        print(f"🔄 [{u['username']}] 계정 업데이트 완료 (배정 건물: {u['assigned_branch_id']})")
    else:
        new_id = str(uuid.uuid4())
        c.execute("""
            INSERT INTO rent_users (id, username, password, name, phone, role, assigned_branch_id, status, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (new_id, u["username"], u["password"], u["name"], u["phone"], u["role"], u["assigned_branch_id"], u["status"], u["reason"]))
        print(f"✨ [{u['username']}] 계정 신규 생성 완료 (배정 건물: {u['assigned_branch_id']})")

conn.commit()
conn.close()
print("🎉 모든 점주 계정 동기화 완료!")
