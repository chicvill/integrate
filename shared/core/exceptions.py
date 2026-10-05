"""
shared/core/exceptions.py
MQnet 통합 SaaS 플랫폼 표준 예외 클래스 정의.
FastAPI 앱 전역에서 일관된 에러 응답(JSON)을 처리할 수 있도록 지원합니다.
"""
from typing import Any, Optional, Dict


class AppException(Exception):
    """모든 MQnet 비즈니스 예외의 기본 클래스"""
    status_code: int = 400
    error_code: str = "BAD_REQUEST"
    message: str = "잘못된 요청입니다."

    def __init__(
        self,
        message: Optional[str] = None,
        error_code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[Any] = None,
    ):
        self.message = message or self.message
        self.error_code = error_code or self.error_code
        self.status_code = status_code or self.status_code
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "success": False,
            "error": self.message,
            "error_code": self.error_code,
        }
        if self.details is not None:
            result["details"] = self.details
        return result


class NotFoundError(AppException):
    """리소스를 찾을 수 없을 때 (404)"""
    status_code = 404
    error_code = "NOT_FOUND"
    message = "요청한 리소스를 찾을 수 없습니다."


class UnauthorizedError(AppException):
    """인증 실패 또는 토큰 누락 (401)"""
    status_code = 401
    error_code = "UNAUTHORIZED"
    message = "인증이 필요하거나 유효하지 않은 자격 증명입니다."


class ForbiddenError(AppException):
    """권한 부족 (403)"""
    status_code = 403
    error_code = "FORBIDDEN"
    message = "해당 작업을 수행할 권한이 없습니다."


class ConflictError(AppException):
    """데이터 충돌 또는 중복 (409)"""
    status_code = 409
    error_code = "CONFLICT"
    message = "이미 존재하는 리소스이거나 충돌이 발생했습니다."


class RateLimitError(AppException):
    """사용량/요청 한도 초과 (429)"""
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"
    message = "요청 한도를 초과했습니다. 잠시 후 다시 시도하세요."


class ServiceUnavailableError(AppException):
    """외부 서비스 장애 또는 시스템 준비 중 (503)"""
    status_code = 503
    error_code = "SERVICE_UNAVAILABLE"
    message = "서비스를 일시적으로 사용할 수 없습니다."
