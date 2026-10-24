"""
kernel/base.py — 모든 도메인 객체의 부모 클래스 `Obj`.

객체는 스스로 저장/검색/삭제하고, 행동(메서드)에 비즈니스 규칙을 가진다.
저장은 항상 같은 모양이라 스키마 마이그레이션이 필요 없다 (extra="allow": 현실의 필드는 늘어난다).
"""
import os
from contextvars import ContextVar
from typing import Any, ClassVar, Dict, List, Optional, Type, TypeVar
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from .store import Store

T = TypeVar("T", bound="Obj")

REGISTRY: Dict[str, Type["Obj"]] = {}
actor: ContextVar[str] = ContextVar("actor", default="system")   # 누가 바꿨나 (사용자 / ai:사용자 / system)
_store: Optional[Store] = None


def store() -> Store:
    """프로세스 단일 저장소 (RENT2_DB 환경변수 또는 메모리)"""
    global _store
    if _store is None:
        _store = Store(os.getenv("OBJ_DB", ":memory:"))
    return _store


def use_store(path: str = ":memory:") -> Store:
    global _store
    if _store is not None:
        _store.close()
    _store = Store(path)
    return _store


class Obj(BaseModel):
    model_config = ConfigDict(extra="allow", validate_assignment=True)

    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    scope_field: ClassVar[str] = ""          # 소속 키 필드 이름 (예: Contract.building_id)

    @classmethod
    def __pydantic_init_subclass__(cls, **kw: Any) -> None:
        REGISTRY[cls.kind()] = cls

    @classmethod
    def kind(cls) -> str:
        return cls.__name__.lower()

    @property
    def key(self) -> str:
        return f"{self.kind()}:{self.id}"

    @property
    def scope(self) -> str:
        return str(getattr(self, self.scope_field, "") or "") if self.scope_field else ""

    # ── 저장 · 조회 ──
    def save(self: T, action: str = "saved", **detail: Any) -> T:
        s = store()
        s.put(self.key, self.kind(), self.scope, self.model_dump())
        s.log(self.kind(), self.key, self.scope, action, actor.get(), detail or {"summary": self.summary()})
        return self

    def delete(self, action: str = "deleted") -> None:
        store().delete(self.key)
        store().log(self.kind(), self.key, self.scope, action, actor.get(), {"summary": self.summary()})

    @classmethod
    def get(cls: Type[T], id: str) -> Optional[T]:
        d = store().get(f"{cls.kind()}:{id}")
        return cls.model_validate(d) if d else None

    @classmethod
    def find(cls: Type[T], scope: Optional[str] = None, **where: Any) -> List[T]:
        return [cls.model_validate(d) for d in store().find(cls.kind(), scope, **where)]

    @classmethod
    def all(cls: Type[T]) -> List[T]:
        return cls.find()

    @classmethod
    def purge(cls, scope: str, **where: Any) -> int:
        return store().delete_where(cls.kind(), scope, **where)

    # ── AI/사람이 읽는 한 줄 기억 (검색 결과·타임라인에 노출) ──
    def summary(self) -> str:
        return f"{self.kind()}:{self.id}"


def recall(text: str, kinds: Optional[List[str]] = None, scope: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    """자연어 키워드로 객체를 떠올린다 → [{kind, id, scope, summary, data}]"""
    out = []
    for h in store().search(text, kinds, scope, limit):
        cls = REGISTRY.get(h["kind"])
        obj = cls.model_validate(h["data"]) if cls else None
        out.append({"kind": h["kind"], "id": h["data"].get("id"), "scope": h["scope"],
                    "summary": obj.summary() if obj else str(h["data"])[:80], "data": h["data"]})
    return out
