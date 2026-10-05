"""
apps/smartfarm/backend/db/database.py
Connects SmartFarm DB to shared.core.base_database.
"""
from shared.core.base_database import Base, get_db, init_database

_db = init_database()
engine = _db.engine
SessionLocal = _db.SessionLocal

__all__ = ["Base", "get_db", "engine", "SessionLocal"]
