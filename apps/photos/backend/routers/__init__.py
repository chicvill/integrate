"""
apps/photos/backend/routers/__init__.py
"""
from apps.photos.backend.routers.gallery import router as gallery_router
from apps.photos.backend.routers.ai_vision import router as ai_vision_router

__all__ = ["gallery_router", "ai_vision_router"]
