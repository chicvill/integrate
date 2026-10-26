"""
core/errors.py — 도메인 예외 표준.

라우터에서 try/except 로 감쌀 필요 없이 도메인 객체가 DomainError 를 던지면
게이트웨이 예외 핸들러가 프론트엔드 알림 배너 규격(JSON)으로 변환한다.

level → 배너 색상
  warning : 황색  (이미 처리됨 / 중복 실행 / 안내)
  diff    : 주황색 (입력값과 기대값 불일치)
  error   : 적색  (처리 실패)
"""
from typing import Any, Dict, Optional


class DomainError(Exception):
    status_code = 400
    level = "warning"

    def __init__(self, message: str, *, hint: str = "", level: Optional[str] = None,
                 status_code: Optional[int] = None, **extra: Any):
        super().__init__(message)
        self.message = message
        self.hint = hint
        if level:
            self.level = level
        if status_code:
            self.status_code = status_code
        self.extra = extra

    def to_dict(self) -> Dict[str, Any]:
        return {"success": False, "level": self.level, "message": self.message,
                "hint": self.hint, **self.extra}


class NotFound(DomainError):
    status_code = 404
    level = "error"


class Conflict(DomainError):
    """이미 처리됨 / 상태 충돌 (황색 안내)."""
    status_code = 409
    level = "warning"


class Mismatch(DomainError):
    """금액·수량 등 입력과 기대값 차이 (주황색 안내)."""
    status_code = 422
    level = "diff"


class Forbidden(DomainError):
    status_code = 403
    level = "error"
