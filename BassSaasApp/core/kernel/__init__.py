"""core.kernel — 스키마리스 도메인 객체 커널."""
from .obj import REGISTRY, Obj, actor, store, use_store
from .store import Store

__all__ = ["Obj", "Store", "REGISTRY", "actor", "store", "use_store"]
