"""
apps/studycafe/backend/routers/seats.py
하위 호환성을 위해 seat_router를 re-export합니다.
"""
from apps.studycafe.backend.routers.seat_router import router

__all__ = ["router"]
