"""
apps/files/backend/services/quota_service.py
User storage quota calculation, categorized breakdown, and upgrade management.
"""
import os
from pathlib import Path
from typing import Dict, Any, List

from apps.files.backend.config import settings
from apps.files.backend.schemas import StorageQuotaResponse, CategoryBreakdownItem
from apps.files.backend.services.files_service import (
    format_size,
    categorize_file,
    CATEGORY_MAP,
    EXCLUDE_NAMES,
)

# 플랜별 용량 정의
PLAN_QUOTAS = {
    "free": {
        "name": "무료 플랜",
        "max_bytes": 500 * 1024,  # 500 KB (512,000 B)
        "formatted": "500 KB",
    },
    "pro": {
        "name": "MQnet Pro 플랜",
        "max_bytes": 10 * 1024 * 1024 * 1024,  # 10 GB
        "formatted": "10 GB",
    },
}

# 메모리/세션 기반 사용자 플랜 상태 저장 (추후 DB 연동 확장 가능)
_user_plans: Dict[str, str] = {
    "demo_user": "free",
}

CATEGORY_LABELS = {
    "image": "사진/이미지",
    "video": "동영상",
    "audio": "음악/오디오",
    "document": "문서",
    "code": "코드/텍스트",
    "archive": "압축 파일",
    "general": "기타 파일",
}


def get_user_plan(user_id: str) -> str:
    return _user_plans.get(user_id, "free")


def set_user_plan(user_id: str, plan_tier: str) -> str:
    tier = plan_tier.lower()
    if tier not in PLAN_QUOTAS:
        tier = "free"
    _user_plans[user_id] = tier
    return tier


def calculate_storage_quota(target_dir: Path, user_id: str = "demo_user") -> StorageQuotaResponse:
    """
    지정된 디렉토리의 실제 파일들을 탐색하여 카테고리별 실시간 용량 및 쿼터 반환
    """
    plan_tier = get_user_plan(user_id)
    plan_info = PLAN_QUOTAS.get(plan_tier, PLAN_QUOTAS["free"])
    max_bytes = plan_info["max_bytes"]

    # 카테고리별 카운터 초기화
    cat_bytes: Dict[str, int] = {k: 0 for k in CATEGORY_MAP.keys()}
    cat_bytes["general"] = 0
    cat_counts: Dict[str, int] = {k: 0 for k in CATEGORY_MAP.keys()}
    cat_counts["general"] = 0

    total_used = 0

    if target_dir.exists():
        for root, dirs, files in os.walk(target_dir):
            dirs[:] = [d for d in dirs if d.lower() not in EXCLUDE_NAMES and not d.startswith(".")]
            for fname in files:
                if fname.lower() in EXCLUDE_NAMES or fname.startswith("."):
                    continue
                fp = Path(root) / fname
                try:
                    sz = fp.stat().st_size
                    total_used += sz
                    ext = fp.suffix
                    cat, _ = categorize_file(ext)
                    if cat not in cat_bytes:
                        cat = "general"
                    cat_bytes[cat] += sz
                    cat_counts[cat] += 1
                except (OSError, PermissionError):
                    continue

    usage_pct = round(min(100.0, (total_used / max_bytes) * 100), 1) if max_bytes > 0 else 0.0
    is_exceeded = total_used >= max_bytes

    # 카테고리별 아이템 생성
    breakdown: List[CategoryBreakdownItem] = []
    for cat, b in cat_bytes.items():
        pct = round((b / total_used) * 100, 1) if total_used > 0 else 0.0
        breakdown.append(CategoryBreakdownItem(
            category=cat,
            label=CATEGORY_LABELS.get(cat, cat),
            bytes=b,
            formatted=format_size(b),
            percentage=pct,
            count=cat_counts.get(cat, 0),
        ))

    # 사용량 많은 순으로 정렬
    breakdown.sort(key=lambda x: x.bytes, reverse=True)

    return StorageQuotaResponse(
        user_id=user_id,
        plan_tier=plan_tier,
        plan_name=plan_info["name"],
        max_quota_bytes=max_bytes,
        max_quota_formatted=plan_info["formatted"],
        total_used_bytes=total_used,
        total_used_formatted=format_size(total_used),
        usage_percentage=usage_pct,
        is_exceeded=is_exceeded,
        breakdown=breakdown,
    )


def check_upload_quota(target_dir: Path, incoming_bytes: int, user_id: str = "demo_user") -> Dict[str, Any]:
    """
    신규 파일 업로드 시 사전 용량 초과 여부 검사.
    초과 시 에러 세부 정보 반환, 허용 시 None 반환.
    """
    quota = calculate_storage_quota(target_dir, user_id)
    projected = quota.total_used_bytes + incoming_bytes

    if projected > quota.max_quota_bytes:
        return {
            "exceeded": True,
            "current_used_bytes": quota.total_used_bytes,
            "current_used_formatted": quota.total_used_formatted,
            "incoming_bytes": incoming_bytes,
            "incoming_formatted": format_size(incoming_bytes),
            "max_quota_bytes": quota.max_quota_bytes,
            "max_quota_formatted": quota.max_quota_formatted,
            "plan_tier": quota.plan_tier,
            "message": f"저장 공간({quota.max_quota_formatted})을 초과했습니다. 현재 사용량: {quota.total_used_formatted}, 추가 필요: {format_size(incoming_bytes)}"
        }

    return {"exceeded": False}
