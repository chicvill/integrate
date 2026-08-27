import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

from db import DatabaseManager, UserRepository

def reset_database():
    print("==================================================")
    print("  SelfStudy Database Clean Reset & Init Script")
    print("==================================================")
    
    # 1. If local SQLite file exists, remove it for a clean slate (if using SQLite)
    sqlite_path = os.path.join(os.path.dirname(__file__), 'backend', 'selfstudy.db')
    if os.path.exists(sqlite_path):
        try:
            os.remove(sqlite_path)
            print(f"[OK] Removed local SQLite file: {sqlite_path}")
        except Exception as e:
            print(f"[WARN] Could not remove SQLite file: {e}")

    # 2. Re-initialize DB Manager (creates tables automatically)
    db_mgr = DatabaseManager()
    user_repo = UserRepository(db_mgr)
    
    # 3. Check & Create default admin user
    user_repo.update_user_info('010-1111-2222', '관리자', '1212')
    user_repo.register_user('010-1111-2222', '1212', '관리자')
    
    admin = user_repo.get_user_info('010-1111-2222')
    if admin:
        print(f"[SUCCESS] Admin account verified in DB:")
        print(f"  - User ID: {admin['user_id']}")
        print(f"  - Password: {admin['password']}")
        print(f"  - Name: {admin['name']}")
    else:
        print("[ERR] Failed to verify admin account in DB")

if __name__ == "__main__":
    reset_database()
