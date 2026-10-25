"""임차 도메인 패키지: 객체 + 규칙 + AI 도구. bootstrap()으로 기동 시 1회 초기화."""
import json
import os
from typing import Any, Optional

from ..kernel import agent, identity
from ..kernel.base import store
from ..kernel.identity import seed_users
from . import ai_tools  # noqa: F401  (도구 등록)
from .rent import ROOM_NUMBERS, Building, Contract

# 건물 별칭은 코드가 아니라 '데이터'(Building.aliases)다. 신규 건물 생성 시 알려진 별칭을 붙인다.
ALIASES = {
    "main": ["chicvill01", "chicvill1", "chicvill", "시크빌", "시크빌1호점", "시크빌 1호점"],
    "branch_9027": ["chicvill02", "chicvill2", "시크빌2호점", "시크빌 2호점"],
    "branch_5611": ["sunhovill", "sunho", "선호빌", "선호원룸", "선호아트빌"],
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
    """기동 1회: 별칭 해석기 연결 → 기본 계정 → 기본 본점(main) 시드 (DB가 완전히 비었을 때만 1회 생성)"""
    global _ready_store
    s = store()
    identity.scope_resolver = Building.canon
    if _ready_store is s:
        return
    seed_users(DEFAULT_USERS)

    target_seed = seed_json
    if not target_seed or not os.path.exists(target_seed):
        def_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "seed_data.json")
        if os.path.exists(def_path):
            target_seed = def_path

    # DB에 건물이 단 1건도 없는 경우에만 최초 기본 본점(시크빌 1호점) 생성
    buildings = Building.all()
    if not buildings:
        b = Building(id="main", name="시크빌 1호점 (본점, 29개실)", units=ROOM_NUMBERS, aliases=ALIASES["main"],
                     contact_phone="010-2345-6789", address="서울특별시 강남구 테헤란로 123").save("seeded")
        if target_seed and os.path.exists(target_seed):
            try:
                with open(target_seed, encoding="utf-8") as f:
                    seed_data = json.load(f)
                    rooms_data = seed_data.get("rooms", {})
                    if rooms_data:
                        b.restore({"rooms": rooms_data})
            except Exception as _seed_err:
                print(f"[bootstrap] 시드 세입자 데이터 복원 경고: {_seed_err}")

    _ready_store = s


def ask(message: str, user: identity.User, building: str = "", mode: str = "confirm") -> dict:
    """자연어 한 줄 → 객체 도구 호출. 지점 관리자는 항상 본인 건물로 고정된다."""
    ctx = {"building": Building.canon(user.branch or building or "main") if user.role != "superadmin" else Building.canon(building or "main")}
    return agent.chat(message, user, ctx, ai_tools.system_prompt(user), mode)
