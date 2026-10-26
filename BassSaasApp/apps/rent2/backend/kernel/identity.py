"""
kernel/identity.py — 로그인 · 역할 · 권한 (모든 앱이 그대로 재사용하는 공통 객체).

User 객체가 스스로 로그인/권한 판정을 한다. 소속(scope)은 앱이 정한다 (임차: 건물, 스터디카페: 지점).
"""
import hashlib
import hmac
import os
from datetime import datetime
from typing import Callable, Dict, List, Optional, Set

from pydantic import Field

from .base import Obj

# 역할 → 허용 행위. "*" 는 모든 소속, 그 외는 본인 소속(User.branch)만.
ROLE_PERMS: Dict[str, Set[str]] = {
    "superadmin": {"read", "write", "admin"},
    "branch_admin": {"read", "write"},
    "user": {"read"},
}
SECRET = os.getenv("OBJ_SECRET", "mqnet-dev-secret")
scope_resolver: Callable[[str], str] = lambda s: s   # 앱이 별칭→정식 ID 변환기를 꽂는다


def _hash(raw: str) -> str:
    return hashlib.sha256(f"mq:{raw}".encode()).hexdigest()


class User(Obj):
    username: str
    pw: str = ""
    name: str = ""
    phone: str = ""
    role: str = "branch_admin"
    branch: Optional[str] = None            # 담당 소속 (superadmin은 None=전체)
    status: str = "PENDING"                 # PENDING / APPROVED / REJECTED
    reason: str = ""
    created: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    @classmethod
    def by_username(cls, username: str) -> Optional["User"]:
        found = cls.find(username=username.strip())
        return found[0] if found else None

    @classmethod
    def create(cls, username: str, password: str, **kw) -> "User":
        if not username.strip() or not password:
            raise ValueError("아이디와 비밀번호를 모두 입력해주세요.")
        if cls.by_username(username):
            raise ValueError(f"이미 존재하는 아이디입니다: {username.strip()}")
        return cls(username=username.strip(), pw=_hash(password.strip()), **kw).save("registered")

    @classmethod
    def login(cls, username: str, password: str) -> "User":
        u = cls.by_username(username)
        if not u or u.pw != _hash(password.strip()):
            raise ValueError("아이디 또는 비밀번호가 올바르지 않습니다.")
        if u.status == "PENDING":
            raise PermissionError("본사 관리자 승인 대기 중인 계정입니다.\n본사 승인 후 로그인하실 수 있습니다.")
        if u.status != "APPROVED":
            raise PermissionError("가입 승인이 거절된 계정입니다. 본사로 문의해주세요." if u.status == "REJECTED" else f"비활성화된 계정입니다 (상태: {u.status})")
        return u

    # ── 권한: 행위(read/write/admin) × 소속 ──
    def can(self, perm: str, scope: str = "") -> bool:
        if self.status != "APPROVED" or perm not in ROLE_PERMS.get(self.role, set()):
            return False
        if self.role == "superadmin":
            return True
        return bool(self.branch) and (not scope or scope_resolver(self.branch) == scope_resolver(scope))

    def set_password(self, raw: str) -> None:
        self.pw = _hash(raw.strip())

    # ── 서명 토큰 (위조 불가, DB 조회 없이 사용자 식별) ──
    def token(self) -> str:
        return f"r2.{self.id}.{hmac.new(SECRET.encode(), self.id.encode(), 'sha256').hexdigest()[:24]}"

    @classmethod
    def from_token(cls, token: str) -> Optional["User"]:
        try:
            tag, uid, sig = (token or "").removeprefix("Bearer ").split(".")
        except ValueError:
            return None
        ok = tag == "r2" and hmac.compare_digest(sig, hmac.new(SECRET.encode(), uid.encode(), "sha256").hexdigest()[:24])
        return cls.get(uid) if ok else None

    def public(self) -> dict:
        return {k: v for k, v in self.model_dump().items() if k != "pw"}

    def summary(self) -> str:
        return f"{self.name or self.username}({self.username}) {self.role} {self.branch or '전체'} {self.status}"


class UpgradeRequest(Obj):
    """등업 신청: 일반 가입자 → 지점 관리자 (본사 승인 대기)"""
    user_name: str
    contact: str
    target_branch: str
    reason: str = ""
    status: str = "PENDING"
    assigned_branch: Optional[str] = None


def seed_users(rows: List[tuple]) -> None:
    """기본 계정 시드: 기동 시 1회 · 이미 있으면 비밀번호 외 속성 갱신"""
    for username, name, role, branch in rows:
        u = User.by_username(username)
        if not u:
            User(username=username, pw=_hash("1212"), name=name, role=role, branch=branch, status="APPROVED").save("seeded")
        else:
            updated = False
            if u.role != role:
                u.role = role
                updated = True
            if u.name != name:
                u.name = name
                updated = True
            if u.branch != branch:
                u.branch = branch
                updated = True
            if u.status != "APPROVED":
                u.status = "APPROVED"
                updated = True
            if updated:
                u.save("admin_sync")
