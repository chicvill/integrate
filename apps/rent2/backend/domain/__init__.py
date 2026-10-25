"""임차 도메인 패키지: 객체 + 규칙 + AI 도구. bootstrap()으로 기동 시 1회 초기화."""
import json
import os
from typing import Any, Optional

from ..kernel import agent, identity
from ..kernel.base import store
from ..kernel.identity import seed_users
from . import ai_tools  # noqa: F401  (도구 등록)
from .rent import ROOM_NUMBERS, Building, Contract, Payment

# 선호빌(15개실) 실물 장부 계약 데이터 (신규 매장 영구 복원 보장)
SUNHO_ROOMS = [
    (201, "윤영규", "2021-02-01", 5000000, 500000, 0, "후불", "010-8856-4915", "장부 2026 전월세", {1: "2026-02-02", 2: "2026-03-03", 3: "2026-04-11", 4: "2026-05-02"}),
    (202, "김수성", "2025-06-24", 5000000, 550000, 0, "후불", "010-7250-7800", "장부 2026 전월세", {1: "2026-01-25", 2: "2026-02-25", 3: "2026-03-21", 4: "2026-04-25"}),
    (203, "이선아", "2021-01-26", 5000000, 500000, 0, "후불", "010-2272-0167", "장부 2026 전월세", {1: "2026-02-25", 2: "2026-03-25", 3: "2026-04-25", 4: "2026-05-24"}),
    (204, "김영규", "2024-05-26", 5000000, 550000, 0, "후불", "010-5092-2750", "장부 2026 전월세", {1: "2026-02-25", 2: "2026-02-25", 3: "2026-03-25", 4: "2026-04-30"}),
    (205, "김현주", "2025-06-30", 5000000, 550000, 0, "후불", "010-2771-7169", "장부 2026 전월세", {1: "2026-02-15", 2: "2026-03-15", 3: "2026-04-14", 4: "2026-05-13"}),
    (206, "김선호", "2026-04-10", 5000000, 550000, 0, "후불", "010-4400-5942", "장부 2026 전월세 (4월 입주)", {}),
    (301, "이호진", "2021-05-10", 0,       550000, 0, "후불", "010-9369-1666", "장부 2026 전월세 (무보증)", {1: "2026-01-17", 2: "2026-02-07", 3: "2026-03-08", 4: "2026-04-08"}),
    (302, "유순열", "2022-09-03", 10000000, 500000, 0, "후불", "010-8439-6232", "장부 2026 전월세", {1: "2026-01-05", 2: "2026-02-04", 3: "2026-03-05", 4: "2026-04-03"}),
    (303, "홍현기", "2024-04-19", 5000000, 550000, 0, "후불", "010-8652-5721", "장부 2026 전월세", {1: "2026-01-18", 2: "2026-02-18", 3: "2026-03-18", 4: "2026-04-18"}),
    (304, "정현욱", "2025-03-24", 5000000, 550000, 0, "후불", "010-8279-1964", "장부 2026 전월세", {1: "2026-01-22", 2: "2026-02-22", 3: "2026-03-22", 4: "2026-04-16"}),
    (305, "배영익", "2017-03-08", 5000000, 500000, 0, "후불", "010-8584-1089", "장부 2026 전월세", {1: "2026-01-30", 2: "2026-02-28", 3: "2026-03-25", 4: "2026-04-24"}),
    (306, "안상영", "2017-10-25", 5000000, 500000, 0, "후불", "010-3714-0812", "장부 2026 전월세", {1: "2026-02-01", 2: "2026-02-28", 3: "2026-03-31", 4: "2026-04-30"}),
    (402, "서용원", "2026-09-01", 5000000, 650000, 0, "후불", "010-4707-0509", "장부 2026 전월세 (9월 입주예정)", {}),
    (403, "홍광택", "2023-11-30", 5000000, 550000, 0, "후불", "010-9924-8246", "장부 2026 전월세", {1: "2026-01-31", 2: "2026-02-28", 3: "2026-03-31", 4: "2026-04-30"}),
    (404, "정홍대", "2020-05-14", 5000000, 600000, 0, "후불", "010-5349-2190", "장부 2026 전월세", {1: "2026-03-31", 2: "2026-03-31", 3: "2026-04-03", 4: "2026-05-30"})
]

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
    """기동 1회: 별칭 해석기 연결 → 기본 계정 → 기본 건물 시드 및 세입자 복원 (자가치유)"""
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

    # 건물이 없으면 기본 생성
    buildings = Building.all()
    if not buildings:
        b = Building(id="main", name="시크빌 1호점 (본점, 29개실)", units=ROOM_NUMBERS, aliases=ALIASES["main"],
                     contact_phone="010-2345-6789", address="서울특별시 강남구 테헤란로 123").save("seeded")
    else:
        b = buildings[0]

    # 세입자(계약) 정보가 0건인 경우 시드 데이터로부터 29개실 자동 복원
    if not Contract.find("main") and target_seed and os.path.exists(target_seed):
        try:
            with open(target_seed, encoding="utf-8") as f:
                seed_data = json.load(f)
                rooms_data = seed_data.get("rooms", {})
                if rooms_data:
                    b.restore({"rooms": rooms_data})
        except Exception as _seed_err:
            print(f"[bootstrap] 시드 세입자 데이터 복원 경고: {_seed_err}")

    # 신규 등록 매장 (선호아트빌 15개실) 자가치유 보존 및 복원
    sunho_b = Building.resolve("branch_5611")
    sunho_units = [x[0] for x in SUNHO_ROOMS]
    if not sunho_b:
        sunho_b = Building(id="branch_5611", name="선호아트빌 (15개실)", units=sunho_units,
                           aliases=ALIASES["branch_5611"], contact_phone="010-9876-5432",
                           address="서울특별시 관악구 신림로 456", monthly_fee=120000, billing_status="PAID").save("seeded")
    else:
        sunho_b.units = sunho_units
        sunho_b.save("units_synced")

    if not Contract.find("branch_5611"):
        try:
            for item in SUNHO_ROOMS:
                u_num, name, m_in, dep, rent, maint, timing, phone, note, pays = item
                c = Contract(building_id="branch_5611", unit=u_num, tenant_name=name, phone=phone,
                             deposit=dep, rent=rent, maintenance=maint, pay_timing=timing, move_in=m_in,
                             memo={"note": note})
                c.save("seeded")
                for m, pdate_str in pays.items():
                    Payment(building_id="branch_5611", unit=u_num, year=2026, month=m,
                            paid=True, paid_date=pdate_str, rent_amount=rent,
                            maintenance_amount=maint, note=f"장부수납 {pdate_str}", tenant_name=name).save("seeded")
        except Exception as _sunho_err:
            print(f"[bootstrap] 선호빌 복원 경고: {_sunho_err}")

    _ready_store = s


def ask(message: str, user: identity.User, building: str = "", mode: str = "confirm") -> dict:
    """자연어 한 줄 → 객체 도구 호출. 지점 관리자는 항상 본인 건물로 고정된다."""
    ctx = {"building": Building.canon(user.branch or building or "main") if user.role != "superadmin" else Building.canon(building or "main")}
    return agent.chat(message, user, ctx, ai_tools.system_prompt(user), mode)
