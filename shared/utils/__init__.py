"""
shared.utils - MQnet 통합 SaaS 플랫폼 공통 유틸리티
"""
from shared.utils.logger import setup_logger
from shared.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    generate_short_code,
    generate_secure_token,
)
from shared.utils.qr_generator import generate_qr_base64, generate_table_qr
from shared.utils.quota_manager import (
    InMemoryQuotaTracker,
    get_client_identifier,
    check_and_increment_quota,
)
from shared.utils.media_helper import (
    sanitize_filename,
    generate_timestamped_filename,
    is_allowed_extension,
    guess_media_mimetype,
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_VIDEO_EXTENSIONS,
    ALLOWED_AUDIO_EXTENSIONS,
    ALLOWED_MEDIA_EXTENSIONS,
)

__all__ = [
    "setup_logger",
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "generate_short_code",
    "generate_secure_token",
    "generate_qr_base64",
    "generate_table_qr",
    "InMemoryQuotaTracker",
    "get_client_identifier",
    "check_and_increment_quota",
    "sanitize_filename",
    "generate_timestamped_filename",
    "is_allowed_extension",
    "guess_media_mimetype",
    "ALLOWED_IMAGE_EXTENSIONS",
    "ALLOWED_VIDEO_EXTENSIONS",
    "ALLOWED_AUDIO_EXTENSIONS",
    "ALLOWED_MEDIA_EXTENSIONS",
]
