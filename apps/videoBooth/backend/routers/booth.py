"""
apps/videoBooth/backend/routers/booth.py
VideoBooth guestbook upload and listing router using shared.storage & media_helper.
"""
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, Response

from shared.storage.local_storage import LocalStorageService
from shared.utils.media_helper import generate_timestamped_filename, guess_media_mimetype

router = APIRouter(prefix="", tags=["Video Booth"])

# VideoBooth 전용 데이터 디렉토리 및 공통 스토리지 서비스 초기화
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
storage = LocalStorageService(base_dir=DATA_DIR, base_url="/videobooth/data")


@router.post("/upload")
async def upload_video(video: UploadFile = File(...)):
    """웹캠 녹화 영상 업로드 및 공통 스토리지 저장"""
    try:
        filename = generate_timestamped_filename(prefix="guestbook", extension="webm")
        contents = await video.read()
        await storage.upload_bytes(
            data=contents,
            path=filename,
            content_type="video/webm",
        )
        return {
            "success": True,
            "message": "영상 저장 완료!",
            "filename": filename,
            "url": storage.get_public_url(filename),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)}")


@router.get("/list")
async def list_videos():
    """저장된 방명록 비디오 목록 조회"""
    try:
        files = await storage.list_files(extensions=[".webm", ".mp4"], reverse=True)
        # 파일명만 추출하여 기존 프론트엔드와 100% 호환
        return [os.path.basename(f) for f in files]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"목록 조회 실패: {str(e)}")


@router.get("/data/{filename}")
async def get_video_file(filename: str):
    """비디오 파일 스트리밍/조회"""
    file_path = storage.get_file_path(filename)
    if not file_path:
        # Fallback to direct bytes if local path not resolved
        data = await storage.get_file_bytes(filename)
        if data is None:
            raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")
        return Response(content=data, media_type=guess_media_mimetype(filename))

    return FileResponse(
        path=file_path,
        media_type=guess_media_mimetype(filename),
        filename=filename,
    )
