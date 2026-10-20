"""임차 도메인 패키지: 객체 + 규칙 + AI 도구. bootstrap()으로 기동 시 1회 초기화."""
import json
import os
from typing import Any, Optional

from ..kernel import agent, identity
from ..kernel.base import store
from ..kernel.identity import seed_users
from . import ai_tools  # noqa: F401  (도구 등록)
from .rent import ROOM_NUMBERS, Building

# 건물 별칭은 코드가 아니라 '데이터'(Building.aliases)다. 신규 건물 생성 시 알려진 별칭을 붙인다.
ALIASES = {
    "main": ["chicvill01", "chicvill1", "chicvill", "시크빌", "시크빌1호점", "시크빌 1호점"],
    "branch_9027": ["chicvill02", "chicvill2", "시크빌2호점", "시크빌 2호점"],
    "branch_5611": ["sunhovill", "sunho", "선호빌", "선호원룸"],
    "branch_9348": ["shinbi", "신비주택"],
}
DEFAULT_USERS = [("admin", "본사 총괄 최고관리자", "superadmin", None), ("chic", "시크빌 점주", "branch_admin", "main"),
                 ("sunho", "선호빌 점주", "branch_admin", "branch_5611"), ("sinbi", "신비주택 점주", "branch_admin", "branch_9348"),
                 ("chicvill", "시크빌 1호점 점주실장", "branch_admin", "main"), ("chickvill", "시크빌 1호점 점주실장", "branch_admin", "main"),
                 ("chicvill01", "시크빌 1호점 점주실장", "branch_admin", "main"), ("admin01", "시크빌 1호점 실장", "branch_admin", "main"),
                 ("chicvill2", "시크빌 2호점 점주실장", "branch_admin", "branch_9027"), ("chicvill02", "시크빌 2호점 점주실장", "branch_admin", "branch_9027"),
                 ("admin02", "시크빌 2호점 실장", "branch_admin", "branch_9027")]
_ready_store: Optional[Any] = None      # 이 저장소 인스턴스로 이미 초기화했는가 (캐시)


def bootstrap(seed_json: Optional[str] = None) -> None:
    """기동 1회: 별칭 해석기 연결 → 기본 계정 → (건물이 하나도 없을 때만) 기본 건물 시드"""
    global _ready_store
    s = store()
    identity.scope_resolver = Building.canon
    if _ready_store is s:
        return
    seed_users(DEFAULT_USERS)
    if not Building.all():
        b = Building(id="main", name="시크빌 1호점 (본점, 29개실)", units=ROOM_NUMBERS, aliases=ALIASES["main"],
                     contact_phone="010-2345-6789", address="서울특별시 강남구 테헤란로 123").save("seeded")
        if seed_json and os.path.exists(seed_json):
            with open(seed_json, encoding="utf-8") as f:
                b.restore({"rooms": json.load(f)["rooms"]})
    _ready_store = s


def ask(message: str, user: identity.User, building: str = "", mode: str = "confirm") -> dict:
    """자연어 한 줄 → 객체 도구 호출. 지점 관리자는 항상 본인 건물로 고정된다."""
    ctx = {"building": Building.canon(user.branch or building or "main") if user.role != "superadmin" else Building.canon(building or "main")}
    return agent.chat(message, user, ctx, ai_tools.system_prompt(user), mode)
