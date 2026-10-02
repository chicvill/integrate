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
from apps.YTDownloader.backend.routers.download import safe_content_disposition, locate_disk_file

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
                disk_path = locate_disk_file(job.filename)
                real_size = round(os.path.getsize(disk_path) / (1024 * 1024), 2) if disk_path and os.path.exists(disk_path) else job.file_size_mb

                items.append(MediaFileItem(
                    filename=job.filename,
                    size_mb=real_size,
                    modified_at=job.created_at.strftime("%Y-%m-%d %H:%M") if job.created_at else "",
                    file_type="audio" if job.mode == "audio" else "video",
                    download_url=f"/api/download/file/{job.id}",
                    stream_url=f"/api/download/stream/{job.id}",
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


@router.get("/stream/{filename:path}")
def stream_media_file(filename: str, download: bool = False):
    """디스크 파일 직접 스트리밍/다운로드 (한글/특수문자 URL 디코딩 지원)"""
    import urllib.parse
    decoded_name = urllib.parse.unquote(filename)
    safe_name = os.path.basename(decoded_name)
    file_path = locate_disk_file(safe_name)

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    from shared.core.responses import safe_file_response
    return safe_file_response(
        path=file_path,
        filename=os.path.basename(file_path),
        as_attachment=download
    )



@router.delete("/delete/{target:path}")
@router.delete("/file/{target:path}")
@router.delete("/{target:path}")
def delete_media_item(target: str, db: Session = Depends(get_db)):
    """작업 ID 또는 파일명을 통해 DB 레코드 및 서버 물리 파일 삭제"""
    import urllib.parse
    decoded_target = urllib.parse.unquote(target).strip()

    deleted_db = False
    deleted_disk = False

    # 1. 숫자인 경우 Job ID로 조회 및 삭제
    if decoded_target.isdigit():
        job_id = int(decoded_target)
        job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
        if job:
            if job.filename:
                file_path = locate_disk_file(job.filename)
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        deleted_disk = True
                    except Exception:
                        pass
            db.delete(job)
            db.commit()
            return {"status": "ok", "message": f"작업 #{job_id} 및 파일이 성공적으로 삭제되었습니다."}

    # 2. 파일명으로 DB 매칭 삭제
    job = db.query(models.DownloadJob).filter(models.DownloadJob.filename == decoded_target).first()
    if job:
        db.delete(job)
        db.commit()
        deleted_db = True

    # 3. 물리 디스크 파일 삭제
    safe_name = os.path.basename(decoded_target)
    file_path = locate_disk_file(safe_name)
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            deleted_disk = True
        except Exception:
            pass

    elif os.path.exists(settings.DOWNLOADS_DIR):
        for real_f in os.listdir(settings.DOWNLOADS_DIR):
            if real_f == safe_name or real_f == decoded_target or urllib.parse.unquote(real_f) == decoded_target:
                try:
                    os.remove(os.path.join(settings.DOWNLOADS_DIR, real_f))
                    deleted_disk = True
                except Exception:
                    pass
                break

    return {"status": "ok", "deleted_db": deleted_db, "deleted_disk": deleted_disk}
