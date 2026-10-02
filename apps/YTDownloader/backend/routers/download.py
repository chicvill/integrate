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

# DB 테이블 및 컬럼 자동 마이그레이션 보장
try:
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import text
    with engine.connect() as conn:
        for col_name, col_type in [
            ("progress", "FLOAT DEFAULT 0.0"),
            ("speed", "VARCHAR(50)"),
            ("eta", "VARCHAR(50)")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE download_jobs ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass
except Exception as e:
    import logging
    logging.getLogger("ytdownloader").warning(f"DB 테이블/컬럼 마이그레이션 확인: {e}")

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
    import time
    db = SessionLocal()
    try:
        job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
        if not job:
            return
        job.status = "DOWNLOADING"
        job.progress = 0.0
        db.commit()

        # 사전 메타데이터 조회 시도 (큐에 "Processing..." 대신 실제 영상 제목 즉시 반영)
        try:
            info = ytdlp_engine.get_video_info(url)
            if info and info.get("title") and (not job.title or job.title == "Processing..."):
                job.title = info["title"]
                db.commit()
        except Exception:
            pass

        last_update = [0.0]
        last_percent = [0.0]

        def on_progress(percent: float, speed: str, eta: str, title: str = None):
            now = time.time()
            if (now - last_update[0] >= 0.3) or (abs(percent - last_percent[0]) >= 1.5) or percent >= 100.0:
                last_update[0] = now
                last_percent[0] = percent
                try:
                    p_db = SessionLocal()
                    p_job = p_db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
                    if p_job and p_job.status == "DOWNLOADING":
                        p_job.progress = percent
                        if speed:
                            p_job.speed = speed
                        if eta:
                            p_job.eta = eta
                        if title and (not p_job.title or p_job.title == "Processing..."):
                            p_job.title = title
                        p_db.commit()
                    p_db.close()
                except Exception:
                    pass

        # 1. 미디어 다운로드 실행 (실시간 진행률 콜백 결합)
        result = ytdlp_engine.download_media(url=url, mode=mode, quality=quality, progress_callback=on_progress)
        job.title = result["title"]
        job.filename = result["filename"]
        job.file_size_mb = result["size_mb"]
        job.progress = 100.0
        job.speed = None
        job.eta = None
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
from shared.core.responses import safe_file_response, build_safe_content_disposition

# 호환성을 위한 별칭 제공 (기존 모듈 호환)
safe_content_disposition = build_safe_content_disposition


def locate_disk_file(filename: str) -> str:
    """BaseConfig 표준 경로 탐색기를 활용한 파일 위치 검색"""
    return settings.locate_file(filename, sub_dir="downloads")


@router.get("/file/{job_id}")
def download_file(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
    if not job or job.status != "COMPLETED" or not job.filename:
        raise HTTPException(status_code=404, detail="파일이 아직 준비되지 않았거나 다운로드에 실패했습니다.")

    file_path = locate_disk_file(job.filename)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="다운로드된 파일을 디스크에서 찾을 수 없습니다.")

    return safe_file_response(
        path=file_path,
        filename=os.path.basename(file_path),
        as_attachment=True
    )


@router.get("/stream/{job_id}")
def stream_file(job_id: int, db: Session = Depends(get_db)):
    """플레이어 재생 전용 스트리밍 (inline Content-Disposition 및 Range 지원)"""
    job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
    if not job or not job.filename:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    file_path = locate_disk_file(job.filename)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="다운로드된 파일을 디스크에서 찾을 수 없습니다.")

    return safe_file_response(
        path=file_path,
        filename=os.path.basename(file_path),
        as_attachment=False
    )



@router.get("/summary-file/{job_id}")
def download_summary_file(job_id: int, db: Session = Depends(get_db)):
    """AI 요약 마크다운 (.md) 파일 다운로드"""
    from fastapi.responses import Response
    job = db.query(models.DownloadJob).filter(models.DownloadJob.id == job_id).first()
    if not job or not job.ai_summary:
        raise HTTPException(status_code=404, detail="AI 요약 내용이 준비되지 않았습니다.")

    title = job.title or "ai_summary"
    safe_title = re.sub(r'[\\/*?:"<>|]', '_', title)
    summary_filename = f"{safe_title}_요약.md"
    cd_header = safe_content_disposition(summary_filename, as_attachment=True)

    return Response(
        content=job.ai_summary.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": cd_header}
    )
