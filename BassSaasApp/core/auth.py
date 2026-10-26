"""
core/auth.py — 플랫폼 공통 인증 (모든 앱이 상속 없이 그대로 사용).

- 사용자도 Kernel Obj (core.user) 로 저장 → 별도 테이블/마이그레이션 없음
- 표준 라이브러리만 사용 (pbkdf2 해싱 + HMAC 서명 토큰)
- 기본 관리자 시드는 저장소당 1회만 수행하고 메모리 플래그로 캐싱 (_seeded_for)

앱 라우터에서의 사용:
    from core.auth import require_role
    @router.post("/danger", dependencies=[Depends(require_role("admin", "superadmin"))])
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Callable, Dict, Optional

from fastapi import APIRouter, Body, Depends, Header

from .errors import DomainError, Forbidden
from .kernel import Obj, store

TOKEN_TTL_SECONDS = 60 * 60 * 12
ROLES = ("superadmin", "admin", "user")
DEFAULT_ACCOUNTS = (
    # username, password, name, role
    ("admin", "1212", "본사 최고관리자", "superadmin"),
)

_secret_cache: Optional[bytes] = None
_seeded_for: Optional[int] = None      # 시드를 마친 Store 객체의 id (저장소 교체 시 자동 재시드)


class Unauthorized(DomainError):
    status_code = 401
    level = "error"


class User(Obj):
    namespace = "core"
    label = "사용자"

    username: str
    name: str = ""
    role: str = "user"
    salt: str = ""
    password_hash: str = ""

    def set_password(self, raw: str) -> "User":
        self.salt = secrets.token_hex(16)
        self.password_hash = _hash(raw, self.salt)
        return self

    def check_password(self, raw: str) -> bool:
        return bool(self.password_hash) and hmac.compare_digest(self.password_hash, _hash(raw, self.salt))

    def public(self) -> Dict[str, Any]:
        return {"id": self.id, "username": self.username, "name": self.name, "role": self.role}

    def summary(self) -> str:
        return f"{self.username} ({self.role})"

    @classmethod
    def by_username(cls, username: str) -> Optional["User"]:
        return cls.first(username=username)


def _hash(raw: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", raw.encode(), salt.encode(), 120_000).hex()


def _secret() -> bytes:
    global _secret_cache
    if _secret_cache is None:
        env = os.getenv("BASS_SECRET")
        _secret_cache = env.encode() if env else secrets.token_bytes(32)
    return _secret_cache


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue_token(user: User, ttl: int = TOKEN_TTL_SECONDS) -> str:
    payload = _b64(json.dumps({"u": user.username, "r": user.role, "exp": int(time.time()) + ttl}).encode())
    sig = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload, sig = token.split(".", 1)
        expected = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_unb64(payload))
        return data if data.get("exp", 0) > time.time() else None
    except ValueError:
        return None


def ensure_default_admins() -> None:
    """기본 계정 시드 — 저장소당 1회만 DB 를 조회한다."""
    global _seeded_for
    current = id(store())
    if _seeded_for == current:
        return
    for username, password, name, role in DEFAULT_ACCOUNTS:
        if not User.by_username(username):
            User(username=username, name=name, role=role).set_password(password).save("seeded")
    _seeded_for = current


# ── FastAPI 의존성 ──
def current_user(authorization: str = Header("")) -> Optional[User]:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    data = verify_token(token)
    return User.by_username(data["u"]) if data else None


def require_user(user: Optional[User] = Depends(current_user)) -> User:
    if user is None:
        raise Unauthorized("로그인이 필요합니다.", hint="포털에서 로그인한 뒤 다시 시도해 주세요.")
    return user


def require_role(*roles: str) -> Callable[..., User]:
    def checker(user: User = Depends(require_user)) -> User:
        if user.role not in roles:
            raise Forbidden(f"'{user.role}' 권한으로는 실행할 수 없습니다.",
                            hint=f"필요 권한: {', '.join(roles)}")
        return user
    return checker


# ── 공통 인증 라우터 (/auth) ──
auth_router = APIRouter()


@auth_router.post("/login")
def login(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    ensure_default_admins()
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    if not username or not password:
        raise DomainError("아이디와 비밀번호를 모두 입력해 주세요.")
    user = User.by_username(username)
    if not user or not user.check_password(password):
        raise Unauthorized("아이디 또는 비밀번호가 올바르지 않습니다.", hint="대소문자와 키보드 언어 설정을 확인해 주세요.")
    return {"success": True, "token": issue_token(user), "user": user.public()}


@auth_router.get("/me")
def me(user: User = Depends(require_user)) -> Dict[str, Any]:
    return {"success": True, "user": user.public()}
