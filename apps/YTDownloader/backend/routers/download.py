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

        # 1. 미디어 다운로드 실행 (타임아웃 및 코덱 최적화 적용)
        result = ytdlp_engine.download_media(url=url, mode=mode, quality=quality)
        job.title = result["title"]
        job.filename = result["filename"]
        job.file_size_mb = result["size_mb"]
        job.status = "COMPLETED"
        db.commit()  # 다운로드 완료 즉시 화면 반영!

        # 2. AI 요약은 다운로드 완료 후 안전하게 백그라운드 처리
        try:
            job.ai_summary = ai_transcribe_engine.summarize_video_content(result["title"])
            db.commit()
        except Exception:
            pass
    except Exception as e:
        try:
            job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
            if job:
                job.status = "FAILED"
                job.error_message = str(e)[:250]
                db.commit()
        except Exception:
            pass
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


import re
import urllib.parse


def safe_content_disposition(filename: str, as_attachment: bool = True) -> str:
    """이모지 및 특수문자 제거한 ASCII fallback 및 RFC 5987 UTF-8 인코딩 헤더 생성"""
    ascii_clean = re.sub(r'[^\w\s\.-]', '', filename)
    ascii_clean = re.sub(r'\s+', '_', ascii_clean).strip('._')
    if not ascii_clean:
        ascii_clean = "media_download.mp4"
    encoded_name = urllib.parse.quote(filename, safe='')
    disposition = "attachment" if as_attachment else "inline"
    return f'{disposition}; filename="{ascii_clean}"; filename*=UTF-8\'\'{encoded_name}'


def locate_disk_file(filename: str) -> str:
    """파일명이나 타임스탬프 접미사로 실제 디스크 파일 100% 매칭"""
    if not filename:
        return ""
    direct_path = os.path.join(settings.DOWNLOADS_DIR, filename)
    if os.path.exists(direct_path):
        return direct_path

    if not os.path.exists(settings.DOWNLOADS_DIR):
        return ""

    # 1. 파일명에서 타임스탬프 추출 (예: _1790923156.m4a)
    suffix_match = re.search(r'_\d+\.(mp4|m4a|webm|mp3|mkv)$', filename)
    if suffix_match:
        suffix = suffix_match.group(0)
        for real_f in os.listdir(settings.DOWNLOADS_DIR):
            if real_f.endswith(suffix):
                return os.path.join(settings.DOWNLOADS_DIR, real_f)

    # 2. 파일명 일부분 매칭
    clean_keyword = re.sub(r'[^\w가-힣]', '', filename)[:15]
    if clean_keyword:
        for real_f in os.listdir(settings.DOWNLOADS_DIR):
            if clean_keyword in re.sub(r'[^\w가-힣]', '', real_f):
                return os.path.join(settings.DOWNLOADS_DIR, real_f)

    return ""


@router.get("/file/{job_id}")
def download_file(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
    if not job or job.status != "COMPLETED" or not job.filename:
        raise HTTPException(status_code=404, detail="파일이 아직 준비되지 않았거나 다운로드에 실패했습니다.")

    file_path = locate_disk_file(job.filename)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="다운로드된 파일을 디스크에서 찾을 수 없습니다.")

    media_type = "video/mp4" if job.mode == "video" else "audio/mp4"
    cd_header = safe_content_disposition(os.path.basename(file_path), as_attachment=True)
    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers={"Content-Disposition": cd_header, "Accept-Ranges": "bytes"}
    )


@router.get("/stream/{job_id}")
def stream_file(job_id: int, db: Session = Depends(get_db)):
    """플레이어 재생 전용 스트리밍 (inline Content-Disposition)"""
    job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
    if not job or not job.filename:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    file_path = locate_disk_file(job.filename)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="다운로드된 파일을 디스크에서 찾을 수 없습니다.")

    media_type = "video/mp4" if job.mode == "video" else "audio/mp4"
    cd_header = safe_content_disposition(os.path.basename(file_path), as_attachment=False)
    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers={"Content-Disposition": cd_header, "Accept-Ranges": "bytes"}
    )
