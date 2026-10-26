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


import os
import re
import time
import urllib.parse
from fastapi.responses import FileResponse


def build_safe_content_disposition(filename: str, as_attachment: bool = True) -> str:
    """
    모든 15개 SaaS 앱이 공통으로 사용하는 안전한 Content-Disposition 헤더 생성기.
    - Starlette/FastAPI의 latin-1 인코딩 제약을 100% 준수 (엄격한 ASCII fallback)
    - 최신 브라우저가 인식하는 RFC 5987 표준 (filename*=UTF-8''...) 지원으로 한글/특수문자 원본 보존
    """
    if not filename:
        filename = "download_file.bin"

    # 1. 파일 확장자 추출
    _, ext = os.path.splitext(filename)
    if not ext:
        ext = ".bin"

    # 2. 순수 ASCII 영문/숫자/언더바/대시만 추출 (한글 및 특수문자 안전 치환)
    ascii_clean = re.sub(r'[^a-zA-Z0-9_\.-]', '_', filename)
    ascii_clean = re.sub(r'_+', '_', ascii_clean).strip('._')

    try:
        ascii_clean = ascii_clean.encode('ascii', 'ignore').decode('ascii')
    except Exception:
        ascii_clean = ""

    if not ascii_clean or ascii_clean == ext.lstrip('.'):
        ascii_clean = f"media_{int(time.time())}{ext}"
    elif not ascii_clean.lower().endswith(ext.lower()):
        ascii_clean = f"{ascii_clean}{ext}"

    # 3. RFC 5987 UTF-8 인코딩
    encoded_name = urllib.parse.quote(filename, safe='')
    disposition = "attachment" if as_attachment else "inline"
    return f'{disposition}; filename="{ascii_clean}"; filename*=UTF-8\'\'{encoded_name}'


def safe_file_response(
    path: str,
    filename: Optional[str] = None,
    as_attachment: bool = False,
    media_type: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None
) -> FileResponse:
    """
    모든 15개 SaaS 앱이 공통으로 사용하는 표준 파일/미디어 응답 팩토리.
    - 비디오/오디오 HTML5 플레이어 스트리밍(Accept-Ranges: bytes) 자동 활성화
    - 한글 파일명 다운로드 시 500 UnicodeEncodeError 방지
    """
    safe_name = filename or os.path.basename(path)
    cd_header = build_safe_content_disposition(safe_name, as_attachment=as_attachment)

    # 미디어 타입 자동 감지
    if not media_type:
        lower_name = safe_name.lower()
        if lower_name.endswith((".mp4", ".m4v")):
            media_type = "video/mp4"
        elif lower_name.endswith((".webm",)):
            media_type = "video/webm"
        elif lower_name.endswith((".m4a", ".aac")):
            media_type = "audio/mp4"
        elif lower_name.endswith((".mp3",)):
            media_type = "audio/mpeg"
        elif lower_name.endswith((".wav",)):
            media_type = "audio/wav"
        elif lower_name.endswith((".jpg", ".jpeg")):
            media_type = "image/jpeg"
        elif lower_name.endswith((".png",)):
            media_type = "image/png"
        elif lower_name.endswith((".webp",)):
            media_type = "image/webp"
        elif lower_name.endswith((".pdf",)):
            media_type = "application/pdf"
        elif lower_name.endswith((".md", ".txt")):
            media_type = "text/plain; charset=utf-8"
        else:
            media_type = "application/octet-stream"

    resp_headers = {
        "Content-Disposition": cd_header,
        "Accept-Ranges": "bytes"
    }
    if headers:
        resp_headers.update(headers)

    return FileResponse(
        path=path,
        media_type=media_type,
        headers=resp_headers
    )

