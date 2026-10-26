"""
apps/studycafe/backend/routers/tickets.py
하위 호환성을 위해 ticket_router를 re-export합니다.
"""
from apps.studycafe.backend.routers.ticket_router import router

__all__ = ["router"]
