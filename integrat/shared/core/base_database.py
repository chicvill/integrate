"""
shared/core/base_database.py
모든 앱이 공통으로 사용하는 SQLAlchemy DB 엔진/세션 기반 클래스.
Supabase(PostgreSQL) 또는 로컬 SQLite를 지원하며,
원격 DB 연결 오류 시 자동으로 로컬 SQLite로 안전 폴백합니다.
"""
import os
import logging
from sqlalchemy import create_engine, Column, String, DateTime, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timezone
from typing import Generator

logger = logging.getLogger("mqnet.db")
Base = declarative_base()


def get_database_url() -> str:
    # 환경변수 확인
    url = os.getenv("DATABASE_URL")
    if not url:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env.shared")
        if os.path.exists(env_file):
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("DATABASE_URL="):
                        url = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                        break
    return url or "sqlite:///./integrat.db"


class BaseDatabase:
    def __init__(self, database_url: str = None):
        self.database_url = database_url or get_database_url()
        self._init_engine()

    def _init_engine(self):
        connect_args = {"check_same_thread": False} if "sqlite" in self.database_url else {}
        try:
            self.engine = create_engine(self.database_url, connect_args=connect_args, pool_pre_ping=True)
            # 연결 테스트
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            logger.info(f"DB 연결 성공: {self.database_url[:30]}...")
        except Exception as e:
            logger.warning(f"원격 DB 연결 불가 ({e}). 로컬 SQLite로 안전 전환합니다.")
            self.database_url = "sqlite:///./integrat.db"
            self.engine = create_engine(self.database_url, connect_args={"check_same_thread": False})
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        self.create_tables()

    def create_tables(self):
        try:
            Base.metadata.create_all(bind=self.engine)
        except Exception as e:
            logger.warning(f"테이블 생성 알림: {e}")

    def get_session(self) -> Generator[Session, None, None]:
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()


_db_instance: BaseDatabase | None = None


def init_database(database_url: str = None) -> BaseDatabase:
    global _db_instance
    _db_instance = BaseDatabase(database_url)
    return _db_instance


def get_db() -> Generator[Session, None, None]:
    global _db_instance
    if _db_instance is None:
        _db_instance = init_database()
    yield from _db_instance.get_session()


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class AppIdMixin:
    app_id = Column(String(50), nullable=False, index=True, default="base")