"""
core/kernel/obj.py — 모든 도메인 객체의 부모 클래스 `Obj`.

- 객체는 스스로 저장/조회/삭제하고, 행동(메서드)에 비즈니스 규칙을 가진다.
- kind 는 `{앱 네임스페이스}.{클래스명}` 으로 자동 결정된다.
  예) apps/laundry/backend/domain.py 의 Washer → "laundry.washer"
  → 100개 앱이 하나의 저장소를 공유해도 이름 충돌이 없다.
- extra="allow": 현실의 필드는 늘어난다. 스키마 마이그레이션 불필요.
"""
import os
from contextvars import ContextVar
from datetime import datetime
from typing import Any, ClassVar, Dict, List, Optional, Set, Type, TypeVar
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from ..errors import NotFound
from .store import Store

T = TypeVar("T", bound="Obj")

REGISTRY: Dict[str, Type["Obj"]] = {}
APP_PACKAGES: Set[str] = {"apps"}      # 앱 루트 패키지 이름들 (로더가 등록)
actor: ContextVar[str] = ContextVar("actor", default="system")   # 누가 바꿨나
_store: Optional[Store] = None


def store() -> Store:
    """프로세스 단일 저장소 (BASS_DB 환경변수 또는 메모리)."""
    global _store
    if _store is None:
        _store = Store(os.getenv("BASS_DB", ":memory:"))
    return _store


def use_store(path: str = ":memory:") -> Store:
    """저장소 교체 (게이트웨이 기동 / 테스트 격리용)."""
    global _store
    if _store is not None:
        _store.close()
    _store = Store(path)
    return _store


def _namespace_of(module: str) -> str:
    parts = module.split(".")
    if len(parts) >= 2 and parts[0] in APP_PACKAGES:
        return parts[1]
    return "core"


class Obj(BaseModel):
    model_config = ConfigDict(extra="allow", validate_assignment=True)

    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))

    namespace: ClassVar[str] = ""        # 비우면 모듈 경로에서 자동 추론
    scope_field: ClassVar[str] = ""      # 소속(테넌트/지점) 키 필드 이름
    label: ClassVar[str] = ""            # 사람이 읽는 객체 이름 (오류 메시지용)

    @classmethod
    def __pydantic_init_subclass__(cls, **kw: Any) -> None:
        super().__pydantic_init_subclass__(**kw)
        if not cls.__dict__.get("namespace"):
            cls.namespace = _namespace_of(cls.__module__)
        REGISTRY[cls.kind()] = cls

    @classmethod
    def kind(cls) -> str:
        return f"{cls.namespace}.{cls.__name__.lower()}"

    @property
    def key(self) -> str:
        return f"{self.kind()}:{self.id}"

    @property
    def scope(self) -> str:
        return str(getattr(self, self.scope_field, "") or "") if self.scope_field else ""

    # ── 저장 · 삭제 ──
    def save(self: T, action: str = "saved", **detail: Any) -> T:
        s = store()
        s.put(self.key, self.kind(), self.scope, self.model_dump())
        s.log(self.kind(), self.key, self.scope, action, actor.get(), detail or {"summary": self.summary()})
        return self

    def delete(self, action: str = "deleted") -> None:
        store().delete(self.key)
        store().log(self.kind(), self.key, self.scope, action, actor.get(), {"summary": self.summary()})

    # ── 조회 ──
    @classmethod
    def get(cls: Type[T], id: str) -> Optional[T]:
        d = store().get(f"{cls.kind()}:{id}")
        return cls.model_validate(d) if d else None

    @classmethod
    def require(cls: Type[T], id: str) -> T:
        obj = cls.get(id)
        if obj is None:
            raise NotFound(f"{cls.label or cls.__name__} '{id}'을(를) 찾을 수 없습니다.",
                           hint="목록을 새로고침한 뒤 다시 선택해 주세요.")
        return obj

    @classmethod
    def find(cls: Type[T], scope: Optional[str] = None, **where: Any) -> List[T]:
        return [cls.model_validate(d) for d in store().find(cls.kind(), scope, **where)]

    @classmethod
    def first(cls: Type[T], scope: Optional[str] = None, **where: Any) -> Optional[T]:
        found = cls.find(scope, **where)
        return found[0] if found else None

    @classmethod
    def all(cls: Type[T]) -> List[T]:
        return cls.find()

    @classmethod
    def count(cls, scope: Optional[str] = None) -> int:
        return store().count(cls.kind(), scope)

    @classmethod
    def history(cls, scope: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        return store().history(cls.kind(), scope, limit)

    # ── 표현 ──
    def summary(self) -> str:
        """타임라인/로그에 남는 한 줄 요약. 하위 클래스에서 재정의."""
        return f"{self.kind()}:{self.id}"

    def card(self) -> Dict[str, Any]:
        """API 응답용 표현. 기본은 전체 필드, 필요 시 재정의."""
        return self.model_dump()
