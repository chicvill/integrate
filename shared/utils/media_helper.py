"""
shared/utils/media_helper.py
미디어 및 파일 업로드 처리 공통 유틸리티.
VideoBooth, YTDownloader, Photos, 관상 분석 등 파일/미디어를 다루는 앱 공통 사용.
"""
import os
import re
import mimetypes
import datetime
from typing import Optional, Set

# 안전한 미디어 확장자 목록
ALLOWED_IMAGE_EXTENSIONS: Set[str] = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
ALLOWED_VIDEO_EXTENSIONS: Set[str] = {".mp4", ".webm", ".mov", ".mkv", ".avi"}
ALLOWED_AUDIO_EXTENSIONS: Set[str] = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}
ALLOWED_MEDIA_EXTENSIONS: Set[str] = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS | ALLOWED_AUDIO_EXTENSIONS


def sanitize_filename(filename: str) -> str:
    """특수문자 및 상위 디렉토리 이동(../) 방지 등 파일명 안전화"""
    basename = os.path.basename(filename)
    # 한글, 영문, 숫자, 하이픈, 언더스코어, 점만 허용
    sanitized = re.sub(r"[^\w\.\-\가-힣]", "_", basename)
    return sanitized.strip() or "unnamed_file"


def generate_timestamped_filename(prefix: str = "file", extension: str = "dat") -> str:
    """타임스탬프 기반 유니크 파일명 생성 (예: guestbook_20260927_120102.webm)"""
    now = datetime.datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    ext = extension.lstrip(".")
    clean_prefix = re.sub(r"[^\w\-]", "_", prefix)
    return f"{clean_prefix}_{timestamp}.{ext}"


def is_allowed_extension(filename: str, allowed_set: Optional[Set[str]] = None) -> bool:
    """허용된 확장자인지 확인"""
    targets = allowed_set or ALLOWED_MEDIA_EXTENSIONS
    _, ext = os.path.splitext(filename)
    return ext.lower() in targets


def guess_media_mimetype(filename: str, default: str = "application/octet-stream") -> str:
    """파일명에서 MIME 타입 추론 (webm, m4a 등 추가 매핑 보강)"""
    _, ext = os.path.splitext(filename.lower())
    extra_types = {
        ".webm": "video/webm",
        ".mp4": "video/mp4",
        ".m4a": "audio/mp4",
        ".webp": "image/webp",
    }
    if ext in extra_types:
        return extra_types[ext]

    guessed, _ = mimetypes.guess_type(filename)
    return guessed or default
