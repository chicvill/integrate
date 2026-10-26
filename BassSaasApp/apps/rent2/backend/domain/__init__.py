"""임차 도메인 패키지: 객체 + 규칙 + AI 도구. bootstrap()으로 기동 시 1회 초기화."""
import json
import os
from typing import Any, Optional

from ..kernel import agent, identity
from ..kernel.base import store
from ..kernel.identity import seed_users
from . import ai_tools  # noqa: F401  (도구 등록)
from .rent import ROOM_NUMBERS, Building, Contract, ChicvillBuilding, SinbiBuilding, SunhoBuilding

# 건물 별칭은 코드가 아니라 '데이터'(Building.aliases)다. 신규 건물 생성 시 알려진 별칭을 붙인다.
ALIASES = {
    "main": ["chicvill01", "chicvill1", "chicvill", "시크빌", "시크빌1호점", "시크빌 1호점", "chic"],
    "sunho": ["branch_5611", "branch_01", "branch_1", "선호", "선호아트빌", "선호빌", "선호원룸", "sunhovill"],
    "sinbi": ["branch_9348", "branch_02", "branch_2", "신비", "신비주택", "신비원룸"],
}
DEFAULT_USERS = [
    ("admin", "본사 총괄 최고관리자", "superadmin", None),
    ("chic", "시크빌 관리자", "branch_admin", "main"),
    ("sunho", "선호아트빌 관리자", "branch_admin", "sunho"),
    ("sinbi", "신비주택 관리자", "branch_admin", "sinbi"),
    ("user", "일반 회원/세입자", "user", None),
]
_ready_store: Optional[Any] = None      # 이 저장소 인스턴스로 이미 초기화했는가 (캐시)


def bootstrap(seed_json: Optional[str] = None) -> None:
    """기동 1회: 별칭 해석기 연결 → 기본 계정 → 시크빌(main), 선호아트빌(sunho), 신비주택(sinbi) 시드"""
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

    # 1. 시크빌 (main, 29개실)
    b_main = Building.get("main")
    if not b_main:
        b_main = ChicvillBuilding(id="main", name="시크빌 (본점, 29개실)", units=ChicvillBuilding.DEFAULT_UNITS, aliases=ALIASES["main"],
                                  contact_phone="010-2345-6789", address="서울특별시 강남구 테헤란로 123").save("seeded")
        if target_seed and os.path.exists(target_seed):
            try:
                with open(target_seed, encoding="utf-8") as f:
                    seed_data = json.load(f)
                    rooms_data = seed_data.get("rooms", {})
                    if rooms_data:
                        b_main.restore({"rooms": rooms_data})
            except Exception as _seed_err:
                print(f"[bootstrap] 시드 세입자 데이터 복원 경고: {_seed_err}")

    # 2. 선호아트빌 (sunho, 15개실)
    if not Building.get("sunho"):
        SunhoBuilding(id="sunho", name="선호아트빌 (15개실)", units=SunhoBuilding.DEFAULT_UNITS, aliases=ALIASES["sunho"],
                      contact_phone="010-7250-7800", address="서울특별시 광진구 자양동 456").save("seeded")

    # 3. 신비주택 (sinbi, 20개실)
    if not Building.get("sinbi"):
        SinbiBuilding(id="sinbi", name="신비주택 (20개실)", units=SinbiBuilding.DEFAULT_UNITS, aliases=ALIASES["sinbi"],
                      contact_phone="010-4281-6453", address="서울특별시 영등포구 신길동 123-45").save("seeded")

    _ready_store = s


def ask(message: str, user: identity.User, building: str = "", mode: str = "confirm") -> dict:
    """자연어 한 줄 → 객체 도구 호출. 지점 관리자는 항상 본인 건물로 고정된다."""
    ctx = {"building": Building.canon(user.branch or building or "main") if user.role != "superadmin" else Building.canon(building or "main")}
    return agent.chat(message, user, ctx, ai_tools.system_prompt(user), mode)
