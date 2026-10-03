"""
apps/files/backend/services/quota_service.py
공통 모듈 shared.storage.quota로부터 스토리지 쿼터 서비스를 상속 및 위임.
(하위 호환성을 완벽히 유지하면서 플랫폼 레벨로 중복 제거)
"""
from shared.storage.quota import (
    PLAN_QUOTAS,
    get_user_plan,
    set_user_plan,
    format_bytes,
    categorize_extension,
    calculate_storage_quota,
    check_upload_quota,
)

__all__ = [
    "PLAN_QUOTAS",
    "get_user_plan",
    "set_user_plan",
    "format_bytes",
    "categorize_extension",
    "calculate_storage_quota",
    "check_upload_quota",
]
