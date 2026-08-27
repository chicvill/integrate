"""
apps/videoBooth/backend/routers/booth.py
VideoBooth guestbook upload and listing router.
"""
import os
import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse

router = APIRouter(prefix="", tags=["Video Booth"])

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)


@router.post("/upload")
async def upload_video(video: UploadFile = File(...)):
    try:
        now = datetime.datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        filename = f"guestbook_{timestamp}.webm"
        file_path = os.path.join(DATA_DIR, filename)

        contents = await video.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        return {"success": True, "message": "영상 저장 완료!", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)}")


@router.get("/list")
def list_videos():
    try:
        if not os.path.exists(DATA_DIR):
            return []
        files = [f for f in os.listdir(DATA_DIR) if f.endswith(".webm")]
        files.sort(reverse=True)
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"목록 조회 실패: {str(e)}")


@router.get("/data/{filename}")
def get_video_file(filename: str):
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")
    return FileResponse(path=file_path, media_type="video/webm", filename=filename)
