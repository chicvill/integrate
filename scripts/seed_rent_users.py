"""
scripts/seed_rent_users.py
시크빌(chic), 선호빌(sunho), 신비주택(sinbi) 점주 계정을 DB에 즉시 등록 및 동기화하는 스크립트.
"""
import uuid
import sys
import os

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shared.core.base_database import get_database_service
from apps.rent.backend.db.database import init_db
from apps.rent.backend.db.models import RentUser

# 1. 테이블 생성 (rent_users 등)
init_db()

db_service = get_database_service()
db = db_service.SessionLocal()

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
    },
    {
        "username": "admin",
        "password": "1212",
        "name": "본사 총괄 최고관리자",
        "phone": "010-0000-0000",
        "role": "superadmin",
        "assigned_branch_id": None,
        "status": "APPROVED",
        "reason": "본사 총괄 최고관리자"
    }
]

for u in users:
    existing = db.query(RentUser).filter(RentUser.username == u["username"]).first()
    if existing:
        existing.password = u["password"]
        existing.name = u["name"]
        existing.phone = u["phone"]
        existing.role = u["role"]
        existing.assigned_branch_id = u["assigned_branch_id"]
        existing.status = u["status"]
        existing.reason = u["reason"]
        print(f"🔄 [{u['username']}] 계정 업데이트 완료 (배정 건물: {u['assigned_branch_id']})")
    else:
        new_user = RentUser(
            id=str(uuid.uuid4()),
            username=u["username"],
            password=u["password"],
            name=u["name"],
            phone=u["phone"],
            role=u["role"],
            assigned_branch_id=u["assigned_branch_id"],
            status=u["status"],
            reason=u["reason"]
        )
        db.add(new_user)
        print(f"✨ [{u['username']}] 계정 신규 생성 완료 (배정 건물: {u['assigned_branch_id']})")

db.commit()

# 검증 출력
print("\n--- [등록된 점주/관리자 계정 검증] ---")
all_users = db.query(RentUser).all()
for u in all_users:
    print(f"👤 아이디: {u.username} | 비번: {u.password} | 성명: {u.name} | 권한: {u.role} | 배정건물: {u.assigned_branch_id} | 상태: {u.status}")

db.close()
print("🎉 점주 계정 동기화 및 검증 완료!")
