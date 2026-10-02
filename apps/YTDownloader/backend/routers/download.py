"""
apps/YTDownloader/backend/routers/download.py
Video download router.
"""
import os
import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from apps.YTDownloader.backend.db.database import get_db, SessionLocal, engine, Base
from apps.YTDownloader.backend.db import models
from apps.YTDownloader.backend.schemas import DownloadRequest, DownloadResponse
from apps.YTDownloader.backend.services.ytdlp_engine import ytdlp_engine
from apps.YTDownloader.backend.services.ai_transcribe import ai_transcribe_engine
from apps.YTDownloader.backend.config import settings

# DB 테이블 자동 생성 보장
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    import logging
    logging.getLogger("ytdownloader").warning(f"DB 테이블 자동 생성 실패(무시가능): {e}")

router = APIRouter(prefix="", tags=["YouTube Downloader"])


@router.get("/jobs", response_model=list[DownloadResponse])
def list_download_jobs(db: Session = Depends(get_db)):
    try:
        return db.query(models.DownloadJob).order_by(models.DownloadJob.created_at.desc()).limit(20).all()
    except Exception as e:
        # 테이블이 없는 경우 즉시 재생성 시도
        try:
            Base.metadata.create_all(bind=engine)
            return db.query(models.DownloadJob).order_by(models.DownloadJob.created_at.desc()).limit(20).all()
        except Exception:
            return []


@router.post("/preview")
def preview_video(payload: DownloadRequest):
    if not payload.url:
        raise HTTPException(status_code=400, detail="유튜브 URL을 입력해주세요.")
    try:
        info = ytdlp_engine.get_video_info(payload.url)
        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"영상 정보를 불러올 수 없습니다: {str(e)}")


def process_download_background(job_id: int, url: str, mode: str, quality: str):
    db = SessionLocal()
    try:
        job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
        if not job:
            return
        job.status = "DOWNLOADING"
        db.commit()

        result = ytdlp_engine.download_media(url=url, mode=mode, quality=quality)
        job.title = result["title"]
        job.filename = result["filename"]
        job.file_size_mb = result["size_mb"]
        job.status = "COMPLETED"
        job.ai_summary = ai_transcribe_engine.summarize_video_content(result["title"])
        db.commit()
    except Exception as e:
        job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/process", response_model=DownloadResponse)
def trigger_download(payload: DownloadRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not payload.url:
        raise HTTPException(status_code=400, detail="유튜브 URL을 입력해주세요.")

    job = models.DownloadJob(
        url=payload.url,
        mode=payload.mode,
        quality=payload.quality,
        status="PENDING"
    )
    try:
        db.add(job)
        db.commit()
        db.refresh(job)
    except Exception:
        db.rollback()
        try:
            Base.metadata.create_all(bind=engine)
            db.add(job)
            db.commit()
            db.refresh(job)
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"작업 등록 실패: {str(err)}")

    background_tasks.add_task(
        process_download_background,
        job_id=job.id,
        url=payload.url,
        mode=payload.mode,
        quality=payload.quality
    )

    return job


@router.get("/status/{job_id}", response_model=DownloadResponse)
def get_download_status(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="다운로드 작업을 찾을 수 없습니다.")
    return job


@router.get("/file/{job_id}")
def download_file(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
    if not job or job.status != "COMPLETED" or not job.filename:
        raise HTTPException(status_code=404, detail="파일이 아직 준비되지 않았거나 다운로드에 실패했습니다.")

    file_path = os.path.join(settings.DOWNLOADS_DIR, job.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="다운로드된 파일을 디스크에서 찾을 수 없습니다.")

    media_type = "video/mp4" if job.mode == "video" else "audio/mp4"
    return FileResponse(path=file_path, filename=job.filename, media_type=media_type)
