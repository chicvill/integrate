"""
shared/storage/quota.py
MQnet 통합 SaaS 플랫폼 공통 스토리지 쿼터 및 사용량 분석 서비스.
- 무료 플랜(Free): 500KB (기본 제한)
- 프로 플랜(Pro): 10GB (월 2,900원 구독 모델)
"""
import os
from pathlib import Path
from typing import Dict, Any, List

# 요금제별 최대 허용 쿼터 정의
PLAN_QUOTAS = {
    "free":  {"name": "무료 플랜 (Free)",  "bytes": 500 * 1024,              "formatted": "500 KB"},
    "basic": {"name": "베이직 플랜 (Basic)", "bytes": 50 * 1024 * 1024,         "formatted": "50 MB"},
    "pro":   {"name": "프로 플랜 (Pro)",   "bytes": 10 * 1024 * 1024 * 1024, "formatted": "10 GB"},
}

# 인메모리 유저 플랜 캐시
_user_plans: Dict[str, str] = {}

EXCLUDE_NAMES = {
    "$recycle.bin", "system volume information", ".git", ".vscode",
    "usb_temp", "__pycache__", ".ds_store", "thumbs.db"
}


def get_user_plan(user_id: str) -> str:
    """사용자의 현재 구독 플랜 반환 (기본값: free)"""
    return _user_plans.get(user_id, "free")


def set_user_plan(user_id: str, plan_tier: str) -> str:
    """사용자의 구독 플랜 설정 (테스트 및 Pro 전환 연동)"""
    if plan_tier in PLAN_QUOTAS:
        _user_plans[user_id] = plan_tier
    return _user_plans.get(user_id, "free")


def format_bytes(b: int) -> str:
    """바이트 단위를 사람이 읽기 쉬운 문자열로 변환"""
    if b < 1024:
        return f"{b} B"
    elif b < 1024 * 1024:
        return f"{b / 1024:.1f} KB"
    elif b < 1024 * 1024 * 1024:
        return f"{b / (1024 * 1024):.1f} MB"
    else:
        return f"{b / (1024 * 1024 * 1024):.2f} GB"


def categorize_extension(ext: str) -> str:
    """확장자별 미디어 카테고리 분류"""
    e = ext.lower()
    if e in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic", ".heif", ".raw"}:
        return "image"
    elif e in {".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv"}:
        return "video"
    elif e in {".mp3", ".m4a", ".wav", ".flac", ".aac", ".ogg"}:
        return "audio"
    elif e in {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".hwp", ".hwpx", ".txt", ".md"}:
        return "document"
    elif e in {".py", ".js", ".json", ".html", ".css", ".ts", ".jsx", ".tsx", ".sql", ".sh", ".bat"}:
        return "code"
    elif e in {".zip", ".rar", ".7z", ".tar", ".gz"}:
        return "archive"
    return "general"


def calculate_storage_quota(target_dir: Path, user_id: str = "demo_user") -> Dict[str, Any]:
    """
    지정된 디렉토리를 스캔하여 실시간 누적 용량과 카테고리별 사용량을 분석
    """
    plan_tier = get_user_plan(user_id)
    plan_info = PLAN_QUOTAS.get(plan_tier, PLAN_QUOTAS["free"])
    max_quota = plan_info["bytes"]

    cat_sizes = {
        "image": 0,
        "video": 0,
        "audio": 0,
        "document": 0,
        "code": 0,
        "archive": 0,
        "general": 0
    }
    file_counts = {k: 0 for k in cat_sizes}
    total_bytes = 0

    target_path = Path(target_dir)
    if target_path.exists() and target_path.is_dir():
        for root, dirs, files in os.walk(target_path):
            dirs[:] = [d for d in dirs if d.lower() not in EXCLUDE_NAMES and not d.startswith(".")]
            for f in files:
                if f.lower() in EXCLUDE_NAMES or f.startswith("."):
                    continue
                fp = Path(root) / f
                try:
                    sz = fp.stat().st_size
                    total_bytes += sz
                    cat = categorize_extension(fp.suffix)
                    cat_key = cat if cat in cat_sizes else "general"
                    cat_sizes[cat_key] += sz
                    file_counts[cat_key] += 1
                except Exception:
                    continue

    used_pct = round((total_bytes / max_quota * 100), 1) if max_quota > 0 else 0.0
    is_exceeded = total_bytes >= max_quota

    breakdown = [
        {"category": "image", "label": "사진/이미지", "bytes": cat_sizes["image"], "formatted": format_bytes(cat_sizes["image"]), "count": file_counts["image"], "color": "#ec4899"},
        {"category": "document", "label": "문서", "bytes": cat_sizes["document"], "formatted": format_bytes(cat_sizes["document"]), "count": file_counts["document"], "color": "#38bdf8"},
        {"category": "audio", "label": "음악/음원", "bytes": cat_sizes["audio"], "formatted": format_bytes(cat_sizes["audio"]), "count": file_counts["audio"], "color": "#a855f7"},
        {"category": "video", "label": "동영상", "bytes": cat_sizes["video"], "formatted": format_bytes(cat_sizes["video"]), "count": file_counts["video"], "color": "#f59e0b"},
        {"category": "code", "label": "코드/데이터", "bytes": cat_sizes["code"], "formatted": format_bytes(cat_sizes["code"]), "count": file_counts["code"], "color": "#10b981"},
        {"category": "archive", "label": "압축 파일", "bytes": cat_sizes["archive"], "formatted": format_bytes(cat_sizes["archive"]), "count": file_counts["archive"], "color": "#6366f1"},
        {"category": "general", "label": "기타 파일", "bytes": cat_sizes["general"], "formatted": format_bytes(cat_sizes["general"]), "count": file_counts["general"], "color": "#94a3b8"}
    ]

    return {
        "user_id": user_id,
        "plan_tier": plan_tier,
        "plan_name": plan_info["name"],
        "max_quota_bytes": max_quota,
        "max_quota_formatted": plan_info["formatted"],
        "total_used_bytes": total_bytes,
        "total_used_formatted": format_bytes(total_bytes),
        "used_percentage": min(100.0, used_pct),
        "is_exceeded": is_exceeded,
        "categories": breakdown
    }


def check_upload_quota(target_dir: Path, upload_size_bytes: int, user_id: str = "demo_user") -> Dict[str, Any]:
    """
    파일 업로드 전 사전 쿼터 초과 여부를 검사
    """
    quota = calculate_storage_quota(target_dir, user_id)
    new_total = quota["total_used_bytes"] + upload_size_bytes
    exceeded = new_total > quota["max_quota_bytes"]

    return {
        "exceeded": exceeded,
        "current_used_bytes": quota["total_used_bytes"],
        "current_used_formatted": quota["total_used_formatted"],
        "incoming_bytes": upload_size_bytes,
        "incoming_formatted": format_bytes(upload_size_bytes),
        "max_quota_bytes": quota["max_quota_bytes"],
        "max_quota_formatted": quota["max_quota_formatted"],
        "plan_tier": quota["plan_tier"],
        "plan_name": quota["plan_name"],
        "message": f"저장 용량 한도({quota['max_quota_formatted']})를 초과합니다! (현재: {quota['total_used_formatted']} + 추가: {format_bytes(upload_size_bytes)})"
    }
