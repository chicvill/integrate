"""
apps/YTDownloader/backend/routers/media.py
Media list router.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from apps.YTDownloader.backend.db.database import get_db
from apps.YTDownloader.backend.db import models
from apps.YTDownloader.backend.schemas import DownloadResponse

router = APIRouter(prefix="", tags=["Media Archive"])


@router.get("/files", response_model=list[DownloadResponse])
@router.get("/recent", response_model=list[DownloadResponse])
def get_recent_downloads(db: Session = Depends(get_db)):
    return db.query(models.DownloadJob).order_by(models.DownloadJob.created_at.desc()).limit(50).all()
