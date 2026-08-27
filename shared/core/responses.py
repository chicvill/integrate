"""
shared/core/responses.py
MQnet 표준 API 응답 헬퍼 및 Pydantic 스키마.
SaaS 앱들의 응답 포맷을 통일하고 프론트엔드 연동을 원활하게 합니다.
"""
from typing import Generic, TypeVar, Optional, Any, Dict
from pydantic import BaseModel
from fastapi.responses import JSONResponse

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """표준 API 응답 래퍼 스키마"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


def success_response(
    data: Any = None,
    message: Optional[str] = None,
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """성공 응답 생성 헬퍼"""
    content = {
        "success": True,
        "message": message,
        "data": data,
    }
    return JSONResponse(status_code=status_code, content=content, headers=headers)


def error_response(
    message: str,
    error_code: str = "ERROR",
    status_code: int = 400,
    details: Optional[Any] = None,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """오류 응답 생성 헬퍼"""
    content = {
        "success": False,
        "error": message,
        "error_code": error_code,
    }
    if details is not None:
        content["details"] = details
    return JSONResponse(status_code=status_code, content=content, headers=headers)
