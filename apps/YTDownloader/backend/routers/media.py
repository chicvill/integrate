"""
apps/YTDownloader/backend/routers/media.py
Media list & stream router formatted for Media Library.
"""
import os
import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from apps.YTDownloader.backend.db.database import get_db
from apps.YTDownloader.backend.db import models
from apps.YTDownloader.backend.schemas import MediaFileItem
from apps.YTDownloader.backend.config import settings

router = APIRouter(prefix="", tags=["Media Archive"])


@router.get("/files", response_model=list[MediaFileItem])
@router.get("/recent", response_model=list[MediaFileItem])
def get_recent_downloads(db: Session = Depends(get_db)):
    """DB 작업 목록 및 디스크 실제 파일을 합쳐 LibraryPage 규격에 맞게 반환"""
    items: list[MediaFileItem] = []
    seen_filenames = set()

    try:
        jobs = db.query(models.DownloadJob).order_by(models.DownloadJob.created_at.desc()).limit(50).all()
        for job in jobs:
            # 1. 완료된 작업
            if job.status == "COMPLETED" and job.filename:
                seen_filenames.add(job.filename)
                disk_path = os.path.join(settings.DOWNLOADS_DIR, job.filename)
                real_size = round(os.path.getsize(disk_path) / (1024 * 1024), 2) if os.path.exists(disk_path) else job.file_size_mb

                items.append(MediaFileItem(
                    filename=job.filename,
                    size_mb=real_size,
                    modified_at=job.created_at.strftime("%Y-%m-%d %H:%M") if job.created_at else "",
                    file_type="audio" if job.mode == "audio" else "video",
                    download_url=f"/api/download/file/{job.id}",
                    status="COMPLETED",
                    title=job.title,
                    job_id=job.id
                ))
            # 2. 진행 중 작업
            elif job.status in ("DOWNLOADING", "PENDING"):
                items.append(MediaFileItem(
                    filename=f"⏳ [다운로드 중] {job.title or job.url}",
                    size_mb=0.0,
                    modified_at=job.created_at.strftime("%Y-%m-%d %H:%M") if job.created_at else "",
                    file_type="audio" if job.mode == "audio" else "video",
                    download_url="",
                    status=job.status,
                    title=job.title,
                    job_id=job.id
                ))
            # 3. 실패한 작업
            elif job.status == "FAILED":
                err_brief = (job.error_message or "다운로드 실패")[:40]
                items.append(MediaFileItem(
                    filename=f"❌ [실패: {err_brief}] {job.title or job.url}",
                    size_mb=0.0,
                    modified_at=job.created_at.strftime("%Y-%m-%d %H:%M") if job.created_at else "",
                    file_type="audio" if job.mode == "audio" else "video",
                    download_url="",
                    status="FAILED",
                    title=job.title,
                    job_id=job.id
                ))
    except Exception as e:
        pass

    # 4. DB에 없더라도 downloads 디렉토리에 실제 존재하는 물리 파일 추가
    if os.path.exists(settings.DOWNLOADS_DIR):
        try:
            for fname in sorted(os.listdir(settings.DOWNLOADS_DIR), reverse=True):
                if fname in seen_filenames or fname.startswith("."):
                    continue
                fpath = os.path.join(settings.DOWNLOADS_DIR, fname)
                if os.path.isfile(fpath):
                    stat = os.stat(fpath)
                    sz = round(stat.st_size / (1024 * 1024), 2)
                    mtime = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
                    ftype = "audio" if fname.lower().endswith((".mp3", ".m4a", ".aac", ".wav")) else "video"
                    items.append(MediaFileItem(
                        filename=fname,
                        size_mb=sz,
                        modified_at=mtime,
                        file_type=ftype,
                        download_url=f"/api/media/stream/{fname}",
                        status="COMPLETED",
                        title=fname,
                        job_id=None
                    ))
        except Exception:
            pass

    return items


@router.get("/stream/{filename}")
def stream_media_file(filename: str):
    """디스크 파일 직접 스트리밍/다운로드"""
    safe_name = os.path.basename(filename)
    file_path = os.path.join(settings.DOWNLOADS_DIR, safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    media_type = "audio/mp4" if safe_name.lower().endswith((".m4a", ".mp3")) else "video/mp4"
    return FileResponse(path=file_path, filename=safe_name, media_type=media_type)
