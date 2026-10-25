"""
apps/rent2/backend/routers/common.py
라우터 전반에서 공통으로 사용되는 의존성(User 토큰 인증, Building/Unit 검색, HTTP 예외 처리, 다운로드 헬퍼 등)
"""
import os
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import Header, HTTPException, Query, Response

from ..domain import ALIASES, Building
from ..domain.rent import Contract, Expense, Unit, num, today
from ..kernel.identity import User


def me(authorization: str = Header(""), token: Optional[str] = Query(None)) -> User:
    """JWT 토큰 기반 현재 사용자 인증 의존성"""
    raw = authorization or (f"Bearer {token}" if token else "")
    u = User.from_token(raw)
    if not u:
        raise HTTPException(401, "로그인이 필요합니다. (인증 토큰 누락 또는 유효하지 않음)")
    return u


def resolve_bid(ref: Optional[str], user: User) -> str:
    """
    사용자 권한에 맞는 정규화된 지점 ID 반환.
    - superadmin: 모든 건물 자유롭게 조회 가능 (기본값 main)
    - branch_admin: 본인 소속 지점만 허용 (타 지점 요청 시 403 차단)
    """
    if user.role != "superadmin":
        my_bid = Building.canon(user.branch or "main")
        if ref and Building.canon(ref) != my_bid:
            raise HTTPException(403, f"접근 거부: 본인 소속 건물 외 타 건물({ref})의 정보에는 접근할 수 없습니다.")
        return my_bid
    return Building.canon(ref or "main")


def get_building(ref: Optional[str], user: Optional[User] = None) -> Building:
    bid = resolve_bid(ref, user) if user else Building.canon(ref)
    return Building.require(bid)


def get_unit(branch_id: Optional[str], n: int, user: Optional[User] = None) -> Unit:
    return get_building(branch_id, user).unit(n)


def get_room(branch_id: Optional[str], n: int, user: Optional[User] = None):
    """O(1) 단건 핀셋 점조회 헬퍼"""
    return get_building(branch_id, user).room(n)


def serialize_branch(b: Building) -> Dict[str, Any]:
    d = b.model_dump()
    res = {**{k: d[k] for k in ("id", "name", "contact_phone", "address", "fee_plan", "monthly_fee", "billing_status",
                                 "billing_due_day", "last_paid_at", "is_active")}, "branch_id": b.id}
    rids = b.room_ids or [f"{b.id}:{u}" for u in b.units]
    res["total_rooms"] = len(b.units)
    res["rooms_count"] = len(b.units)
    res["room_ids"] = rids
    if b.id == "main":
        res["chicvill_room_ids"] = rids
    elif b.id == "sunho":
        res["sunho_room_ids"] = rids
    elif b.id == "sinbi":
        res["sinbi_room_ids"] = rids
    return res


def serialize_expense(e: Expense) -> Dict[str, Any]:
    return {**e.model_dump(), "branch_id": e.building_id}


def serialize_user(u: User) -> Dict[str, Any]:
    b = Building.resolve(u.branch) if u.branch else None
    return {**u.public(), "assigned_branch_id": u.branch, "assigned_branch_name": (b.name if b else u.branch) if u.branch else "전체 권한(본사)",
            "created_at": u.created}


def parse_rooms_csv(s: Optional[str]) -> Optional[List[int]]:
    return [int(r) for r in (s or "").split(",") if r.strip().isdigit()] or None


def file_response(content: bytes, media: str, filename: str) -> Response:
    q = urllib.parse.quote(filename)
    return Response(content, media_type=media, headers={"Content-Disposition": f"attachment; filename=\"{q}\"; filename*=UTF-8''{q}",
                                                         "Access-Control-Expose-Headers": "Content-Disposition"})
