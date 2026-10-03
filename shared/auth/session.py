"""
shared/auth/session.py
MQnet 통합 SaaS - 객체 지향(OOP) 기반 세션 및 로그인 사용자 모델.
모든 앱은 기본 BaseAuthSession을 상속하여 앱 고유의 속성을 유연하게 확장할 수 있습니다.
정회원(Member)과 비회원 임시 세션(Guest) 모두 통일된 객체 인터페이스로 다룹니다.
"""
import os
import shutil
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import Request, Header

logger = logging.getLogger("mqnet.auth.session")


class BaseAuthSession(BaseModel):
    """
    모든 앱 공통 기본 세션/로그인 사용자 객체.
    정회원 및 임시 게스트 모두 동일한 필드와 인터페이스를 제공합니다.
    """
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None          # 로그인 회원의 고유 ID (게스트는 None)
    email: Optional[str] = None            # 로그인 회원의 이메일
    full_name: str = "게스트 이용자"       # 화면 표시 이름
    app_id: str = "platform"               # 현재 접속 앱
    role: str = "guest"                    # superadmin, owner, manager, staff, customer, user, guest
    is_authenticated: bool = False         # 정식 로그인 여부 (True: 정회원, False: 임시 게스트)
    is_guest: bool = True                  # 임시 게스트 세션 여부
    auth_provider: str = "local"           # local, google, naver, guest
    allowed_apps: List[str] = Field(default_factory=lambda: ["*"])
    app_roles: Dict[str, str] = Field(default_factory=dict)
    tenant_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def identifier(self) -> str:
        """회원이면 user_id, 게스트면 session_id 반환"""
        return self.user_id if self.is_authenticated and self.user_id else f"guest_{self.session_id[:8]}"

    def has_role(self, allowed_roles: List[str]) -> bool:
        """역할 기반 권한 확인 (슈퍼어드민은 상시 통과)"""
        if self.role == "superadmin":
            return True
        return self.role in allowed_roles

    def is_app_allowed(self, target_app_id: str) -> bool:
        """앱 접근 권한 확인"""
        if "*" in self.allowed_apps:
            return True
        return target_app_id in self.allowed_apps

    def to_dict(self) -> dict:
        return self.model_dump()


# ─── 1. 매장 관리 앱 확장 세션 객체 ────────────────────────────
class StoreAuthSession(BaseAuthSession):
    """
    매장 관리 (Store) 전용 세션 객체.
    BaseAuthSession을 상속하여 점포 코드, POS 번호, 직책 권한 등을 추가합니다.
    """
    app_id: str = "store"
    store_code: Optional[str] = "STORE-MAIN"
    store_name: Optional[str] = "MQnet 본점"
    pos_terminal_id: Optional[str] = None
    duty_shift: Optional[str] = None  # morning, afternoon, night

    @property
    def is_owner(self) -> bool:
        return self.role == "owner" or self.role == "superadmin"

    @property
    def is_manager(self) -> bool:
        return self.role in ["owner", "manager", "superadmin"]

    @property
    def can_manage_staff(self) -> bool:
        return self.is_manager

    @property
    def can_access_settlement(self) -> bool:
        return self.is_owner


# ─── 2. 스마트 드라이브 & 포토 앱 확장 세션 객체 ─────────────────
class PhotosAuthSession(BaseAuthSession):
    """
    포토 / 미디어 (Photos) 전용 세션 객체.
    개인별 격리 스토리지 경로 및 500KB 쿼터 한도를 관리합니다.
    """
    app_id: str = "photos"
    quota_limit_bytes: int = 512_000   # 무료 플랜 500KB (Pro: 10GB)
    plan_id: str = "free"
    storage_root: str = "/media"

    @property
    def user_dir(self) -> str:
        """개인 격리 디렉토리 경로"""
        if self.is_authenticated and self.user_id:
            return os.path.join(self.storage_root, "users", self.user_id, "photos")
        return os.path.join(self.storage_root, "guest", self.session_id, "photos")


# ─── 3. 유튜브 다운로더 확장 세션 객체 (임시 세션 물리 격리) ──────
class YTDownloadAuthSession(BaseAuthSession):
    """
    유튜브 다운로더 (YTDownloader) 전용 세션 객체.
    2인 이상 동시 접속 시 각 세션마다 독립된 임시 폴더를 부여받고,
    세션 종료 시 해당 세션의 임시 자료만 선별 삭제합니다.
    """
    app_id: str = "ytdownload"
    download_root: str = "/media/downloads"
    daily_quota: int = 20
    cleanup_on_disconnect: bool = True

    @property
    def session_dir(self) -> str:
        """해당 클라이언트 전용 임시 다운로드 디렉토리"""
        return os.path.join(self.download_root, "sessions", self.session_id)

    def ensure_session_dir(self) -> str:
        """세션 디렉토리가 없으면 자동 생성"""
        os.makedirs(self.session_dir, exist_ok=True)
        return self.session_dir

    def cleanup(self) -> bool:
        """
        접속 해제/초기화 시 해당 세션의 임시 자료만 안전하게 삭제.
        다른 동시 접속자의 자료에는 전혀 영향을 주지 않습니다.
        """
        if os.path.exists(self.session_dir):
            try:
                shutil.rmtree(self.session_dir, ignore_errors=True)
                logger.info(f"[YTDownloader] 세션 임시자료 삭제 완료: {self.session_id}")
                return True
            except Exception as e:
                logger.error(f"[YTDownloader] 세션 삭제 오류: {e}")
                return False
        return False


# ─── 팩토리 함수: Request에서 세션 객체 자동 판정 및 생성 ───────
def resolve_session_user(
    request: Request,
    app_id: str = "platform",
    session_cls: type = BaseAuthSession,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> BaseAuthSession:
    """
    요청 헤더를 분석하여 정회원 JWT가 있으면 회원 세션 객체로,
    없으면 X-Session-ID 기반의 격리 게스트 세션 객체로 자동 인스턴스화합니다.
    """
    effective_session_id = x_session_id or request.cookies.get("mqnet_session_id") or str(uuid.uuid4())

    # 1. JWT 토큰 검사
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        from shared.utils.security import decode_access_token
        from shared.core.base_config import get_base_settings
        settings = getattr(request.state, "app_settings", None) or get_base_settings()
        payload = decode_access_token(token, settings.JWT_SECRET, settings.JWT_ALGORITHM)

        if payload:
            user_id = payload.get("sub")
            email = payload.get("email")
            role = payload.get("role", "user")
            allowed_apps = payload.get("allowed_apps", ["*"])
            app_roles = payload.get("app_roles", {})
            auth_provider = payload.get("provider", "local")
            plan_id = payload.get("plan_id", "free")

            init_kwargs = {
                "session_id": effective_session_id,
                "user_id": user_id,
                "email": email,
                "full_name": email.split("@")[0] if email else "회원",
                "app_id": app_id,
                "role": app_roles.get(app_id, role),
                "is_authenticated": True,
                "is_guest": False,
                "auth_provider": auth_provider,
                "allowed_apps": allowed_apps,
                "app_roles": app_roles,
            }
            if session_cls == StoreAuthSession:
                init_kwargs["store_code"] = payload.get("tenant_id") or "STORE-MAIN"
            elif session_cls == PhotosAuthSession:
                init_kwargs["plan_id"] = plan_id
                init_kwargs["quota_limit_bytes"] = 10 * 1024 * 1024 * 1024 if plan_id == "pro" else 512_000

            return session_cls(**init_kwargs)

    # 2. 비로그인/게스트 세션 생성 (임시 로그인 정보로 다룸)
    return session_cls(
        session_id=effective_session_id,
        user_id=None,
        email=None,
        full_name="게스트 이용자",
        app_id=app_id,
        role="guest",
        is_authenticated=False,
        is_guest=True,
        auth_provider="guest",
        allowed_apps=["*"],
    )
