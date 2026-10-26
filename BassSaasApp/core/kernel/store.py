"""
core/kernel/store.py — 스키마리스 문서 저장소 (SQLite WAL).

모든 앱의 모든 도메인 객체가 동일한 두 테이블(objects / logs)에 저장된다.
필드가 늘어나도 DDL 마이그레이션이 필요 없다 → 100개 앱 확장의 핵심.
"""
import json
import os
import sqlite3
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional

_SCHEMA = """
CREATE TABLE IF NOT EXISTS objects (
    key        TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    scope      TEXT NOT NULL DEFAULT '',
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_objects_kind_scope ON objects(kind, scope);
CREATE TABLE IF NOT EXISTS logs (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    kind   TEXT NOT NULL,
    key    TEXT NOT NULL,
    scope  TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    actor  TEXT NOT NULL,
    detail TEXT NOT NULL,
    at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_logs_kind_scope ON logs(kind, scope);
"""


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class Store:
    """프로세스 단일 저장소. 스레드 안전(직렬화 락) + WAL 모드."""

    def __init__(self, path: str = ":memory:"):
        self.path = path
        if path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        if path != ":memory:":
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # ── 객체 ──
    def put(self, key: str, kind: str, scope: str, data: Dict[str, Any]) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO objects(key, kind, scope, data, updated_at) VALUES (?,?,?,?,?) "
                "ON CONFLICT(key) DO UPDATE SET kind=excluded.kind, scope=excluded.scope, "
                "data=excluded.data, updated_at=excluded.updated_at",
                (key, kind, scope or "", json.dumps(data, ensure_ascii=False, default=str), _now()),
            )
            self._conn.commit()

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._conn.execute("SELECT data FROM objects WHERE key=?", (key,)).fetchone()
        return json.loads(row["data"]) if row else None

    def find(self, kind: str, scope: Optional[str] = None, **where: Any) -> List[Dict[str, Any]]:
        sql = "SELECT data FROM objects WHERE kind=?"
        args: List[Any] = [kind]
        if scope is not None:
            sql += " AND scope=?"
            args.append(scope)
        for field, value in where.items():
            if not field.isidentifier():
                raise ValueError(f"잘못된 필드명: {field}")
            sql += f" AND json_extract(data, '$.{field}') IS ?"
            args.append(int(value) if isinstance(value, bool) else value)
        sql += " ORDER BY rowid"
        with self._lock:
            rows = self._conn.execute(sql, args).fetchall()
        return [json.loads(r["data"]) for r in rows]

    def delete(self, key: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM objects WHERE key=?", (key,))
            self._conn.commit()

    def count(self, kind: str, scope: Optional[str] = None) -> int:
        sql, args = "SELECT COUNT(*) FROM objects WHERE kind=?", [kind]
        if scope is not None:
            sql += " AND scope=?"
            args.append(scope)
        with self._lock:
            return int(self._conn.execute(sql, args).fetchone()[0])

    # ── 변경 이력 ──
    def log(self, kind: str, key: str, scope: str, action: str, actor: str, detail: Dict[str, Any]) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO logs(kind, key, scope, action, actor, detail, at) VALUES (?,?,?,?,?,?,?)",
                (kind, key, scope or "", action, actor, json.dumps(detail, ensure_ascii=False, default=str), _now()),
            )
            self._conn.commit()

    def history(self, kind_prefix: str = "", scope: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM logs WHERE kind LIKE ?"
        args: List[Any] = [f"{kind_prefix}%"]
        if scope is not None:
            sql += " AND scope=?"
            args.append(scope)
        sql += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            rows = self._conn.execute(sql, args).fetchall()
        return [{**dict(r), "detail": json.loads(r["detail"])} for r in rows]

    def close(self) -> None:
        with self._lock:
            self._conn.close()
