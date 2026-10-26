"""
apps/selfstudy/backend/db/database.py
Shared database connection wrapper for SelfStudy.
"""
from shared.core.base_database import Base, get_db, init_database, get_database_service

db_service = get_database_service()
engine = db_service.engine
SessionLocal = db_service.SessionLocal
