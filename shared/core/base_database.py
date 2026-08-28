"""
shared/core/base_database.py
모든 앱이 공통으로 사용하는 SQLAlchemy DB 엔진/세션 기반 클래스.
Supabase(PostgreSQL) 또는 로컬 SQLite를 지원하며,
원격 DB 연결 오류 시 자동으로 로컬 SQLite로 안전 폴백합니다.
"""
import os
import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator, Optional

from sqlalchemy import create_engine, Column, String, DateTime, text, event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger("mqnet.db")
Base = declarative_base()


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """SQLite 동시성 및 쓰기 성능 극대화를 위한 WAL 및 Busy Timeout 자동 설정"""
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    except Exception:
        pass


def get_database_url() -> str:
    # 1. 환경변수 우선 확인
    url = os.getenv("DATABASE_URL")
    if not url:
        # 2. .env.shared 파일 탐색
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env.shared")
        if os.path.exists(env_file):
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip().startswith("DATABASE_URL="):
                            url = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                            break
            except Exception:
                pass
    return url or "sqlite:///./integrat.db"


class BaseDatabase:
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or get_database_url()
        self.engine = None
        self.SessionLocal = None
        self._init_engine()

    def _init_engine(self):
        connect_args = {"check_same_thread": False, "timeout": 15} if "sqlite" in self.database_url else {}
        try:
            self.engine = create_engine(
                self.database_url,
                connect_args=connect_args,
                pool_pre_ping=True,
            )
            # 연결 테스트
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            logger.info(f"DB 연결 성공: {self.database_url[:30]}...")
        except Exception as e:
            logger.warning(f"원격 DB 연결 불가 ({e}). 로컬 SQLite로 안전 전환합니다.")
            self.database_url = "sqlite:///./integrat.db"
            self.engine = create_engine(
                self.database_url,
                connect_args={"check_same_thread": False, "timeout": 15},
                pool_pre_ping=True
            )
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        self.create_tables()

    def create_tables(self):
        try:
            Base.metadata.create_all(bind=self.engine)
        except Exception as e:
            logger.warning(f"테이블 생성 알림: {e}")

    def get_session(self) -> Generator[Session, None, None]:
        """FastAPI Depends용 세션 제너레이터"""
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()


_db_instance: Optional[BaseDatabase] = None


def init_database(database_url: Optional[str] = None) -> BaseDatabase:
    """데이터베이스 서비스 싱글톤 초기화"""
    global _db_instance
    _db_instance = BaseDatabase(database_url)
    return _db_instance


def get_database_service(database_url: Optional[str] = None) -> BaseDatabase:
    """데이터베이스 서비스 싱글톤 획득"""
    global _db_instance
    if _db_instance is None:
        _db_instance = init_database(database_url)
    return _db_instance


def get_db() -> Generator[Session, None, None]:
    """FastAPI Depends(get_db)용 의존성 주입 함수"""
    db_service = get_database_service()
    yield from db_service.get_session()


@contextmanager
def db_session() -> Generator[Session, None, None]:
    """
    백그라운드 태스크나 스크립트용 트랜잭션 자동 커밋/롤백 컨텍스트 매니저.
    
    사용 예시:
        with db_session() as db:
            user = db.query(User).first()
    """
    service = get_database_service()
    db = service.SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ─── 공통 Mixin 정의 ─────────────────────────────────────────
class TimestampMixin:
    """생성일시/수정일시 자동 관리 Mixin"""
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class AppIdMixin:
    """멀티테넌트 / 멀티앱 격리용 App ID Mixin"""
    app_id = Column(String(50), nullable=False, index=True, default="base")