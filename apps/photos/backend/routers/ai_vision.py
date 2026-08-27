"""
apps/photos/backend/routers/ai_vision.py
AI Vision Analysis & Auto-tagging router.
"""
from fastapi import APIRouter, HTTPException, Query
from apps.photos.backend.services.ai_engine import photos_ai_engine
from apps.photos.backend.routers.gallery import safe_path

router = APIRouter(prefix="/ai", tags=["Photos AI Vision"])


@router.get("/analyze")
async def analyze_photo(file_path: str = Query(...)):
    abs_path = safe_path(file_path)
    if not abs_path or not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        image_bytes = abs_path.read_bytes()
        res = photos_ai_engine.analyze_image_tags(image_bytes, filename=abs_path.name)
        return {
            "success": True,
            "filename": abs_path.name,
            "analysis": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
