import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text
from apps.YTDownloader.backend.db.database import Base

class DownloadJob(Base):
    __tablename__ = "download_jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True, default="Processing...")
    url = Column(String(500), nullable=False)
    mode = Column(String(20), default="video") # video | audio
    quality = Column(String(20), default="720p") # 1080p, 720p, 480p, audio_m4a
    filename = Column(String(255), nullable=True)
    file_size_mb = Column(Float, default=0.0)
    status = Column(String(20), default="PENDING") # PENDING, DOWNLOADING, COMPLETED, FAILED
    progress = Column(Float, default=0.0)
    speed = Column(String(50), nullable=True)
    eta = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    session_id = Column(String(100), nullable=True, index=True) # 다중 클라이언트 동시 접속 세션 격리
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class UserQuota(Base):
    __tablename__ = "user_quotas"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), default="guest_user")
    downloads_today = Column(Integer, default=0)
    max_daily_quota = Column(Integer, default=50)
    last_reset = Column(DateTime, default=datetime.datetime.utcnow)
