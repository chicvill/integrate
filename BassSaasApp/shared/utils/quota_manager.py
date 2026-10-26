"""
shared/utils/quota_manager.py
MQnet 멀티 SaaS 플랫폼 일일 사용량 & 쿼터(Quota) 관리 유틸리티.

AI 분석, 미디어 다운로드, 고비용 API 등 SaaS 앱 전반에서
비로그인(IP 기준) 또는 로그인 사용자(user_id 기준)의 일일 사용 횟수를 추적하고 제한합니다.
"""
import datetime
import logging
from typing import Dict, Optional, Tuple
from fastapi import Request
from shared.core.exceptions import RateLimitError

logger = logging.getLogger("mqnet.quota")


class InMemoryQuotaTracker:
    """메모리 기반 일일 사용량 카운터 (빠른 검증 및 독립 실행용)"""

    def __init__(self):
        # 구조: {app_id: {date_str: {client_key: count}}}
        self._usage: Dict[str, Dict[str, Dict[str, int]]] = {}

    def get_count(self, app_id: str, client_key: str, date: Optional[datetime.date] = None) -> int:
        target_date = (date or datetime.date.today()).isoformat()
        return self._usage.get(app_id, {}).get(target_date, {}).get(client_key, 0)

    def increment(self, app_id: str, client_key: str, date: Optional[datetime.date] = None) -> int:
        target_date = (date or datetime.date.today()).isoformat()
        if app_id not in self._usage:
            self._usage[app_id] = {}
        if target_date not in self._usage[app_id]:
            # 이전 날짜 데이터 메모리 누수 방지 (당일과 전일만 유지)
            keep_dates = {target_date, (datetime.date.today() - datetime.timedelta(days=1)).isoformat()}
            self._usage[app_id] = {d: self._usage[app_id][d] for d in self._usage[app_id] if d in keep_dates}
            self._usage[app_id][target_date] = {}

        current = self._usage[app_id][target_date].get(client_key, 0)
        new_count = current + 1
        self._usage[app_id][target_date][client_key] = new_count
        return new_count


# 글로벌 싱글톤 트래커
_global_tracker = InMemoryQuotaTracker()


def get_client_identifier(request: Request, user_id: Optional[str] = None) -> str:
    """요청으로부터 고유 사용자 식별자 추출 (user_id 우선, 없으면 클라이언트 IP)"""
    if user_id:
        return f"user:{user_id}"

    # Forwarded IP 헤더 우선 확인 (Cloudflare / Nginx 리버스 프록시 대응)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    elif request.client and request.client.host:
        client_ip = request.client.host
    else:
        client_ip = "anonymous"

    return f"ip:{client_ip}"


def check_and_increment_quota(
    app_id: str,
    client_key: str,
    daily_limit: int,
    is_premium: bool = False,
) -> Tuple[bool, int, int]:
    """
    일일 사용량 검사 및 증가.

    Args:
        app_id: 앱 식별자 (예: 'ai_gwansang', 'face_analy', 'ytdownloader')
        client_key: 클라이언트 식별자 (get_client_identifier로 생성)
        daily_limit: 일일 허용 횟수
        is_premium: 프리미엄/유료 회원 여부 (무제한 허용)

    Returns:
        (허용여부, 현재사용횟수, 남은횟수)

    Raises:
        RateLimitError: 일일 무료 쿼터 초과 시 발생
    """
    if is_premium:
        current = _global_tracker.get_count(app_id, client_key)
        return True, current, 999999

    current = _global_tracker.get_count(app_id, client_key)
    if current >= daily_limit:
        logger.warning(f"[{app_id}] 일일 무료 쿼터 초과: {client_key} (한도: {daily_limit}회)")
        raise RateLimitError(
            message=f"오늘의 무료 이용 횟수({daily_limit}회)를 모두 소진하였습니다. 내일 다시 이용하시거나 프리미엄 플랜을 이용해주세요."
        )

    new_count = _global_tracker.increment(app_id, client_key)
    remaining = max(0, daily_limit - new_count)
    return True, new_count, remaining
