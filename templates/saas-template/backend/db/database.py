"""
templates/saas-template/backend/db/database.py
공통 데이터베이스 서비스(SQLite/PostgreSQL) 연동 및 세션 팩토리.
"""
from typing import Generator
from sqlalchemy.orm import Session
from shared.core.base_database import Base, get_database_service

db_service = get_database_service()
engine = db_service.engine
SessionLocal = db_service.SessionLocal


def get_db() -> Generator[Session, None, None]:
    """FastAPI Depends용 세션 제너레이터"""
    if SessionLocal is None:
        raise RuntimeError("Database session factory (SessionLocal) is not initialized.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
