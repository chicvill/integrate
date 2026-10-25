"""
kernel/store.py — 범용 객체 저장소 (모든 앱이 공유하는 '기억' 계층).

테이블 설계 없이 (kind, scope, JSON 문서) 한 가지 모양으로 모든 객체를 저장하고,
상태 변화는 events 타임라인에 쌓는다. 검색(recall)과 감사 로그가 기본 내장.
"""
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Generator, Iterator, List, Optional

_J = lambda v: json.dumps(v, ensure_ascii=False, default=str)  # noqa: E731


class Store:
    def __init__(self, path: str = ":memory:"):
        if path and path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        if path and path != ":memory:":
            try:
                self.db.execute("PRAGMA journal_mode=WAL;")
                self.db.execute("PRAGMA synchronous=NORMAL;")
            except Exception:
                pass
        self.lock = threading.RLock()
        self._depth, self.quiet = 0, False
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS objects(
                key TEXT PRIMARY KEY, kind TEXT NOT NULL, scope TEXT NOT NULL DEFAULT '',
                data TEXT NOT NULL, created_at TEXT, updated_at TEXT);
            CREATE INDEX IF NOT EXISTS ix_objects ON objects(kind, scope);
            CREATE TABLE IF NOT EXISTS events(
                seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, kind TEXT, obj_key TEXT,
                scope TEXT, action TEXT, actor TEXT, detail TEXT);
            CREATE INDEX IF NOT EXISTS ix_events ON events(scope, obj_key);""")

    # ── 트랜잭션: 대량 작업은 한 번에 커밋(quiet=True면 타임라인 생략) ──
    @contextmanager
    def tx(self, quiet: bool = False) -> Generator[None, None, None]:
        with self.lock:
            self._depth += 1
            prev, self.quiet = self.quiet, self.quiet or quiet
            try:
                yield
                if self._depth == 1:
                    self.db.commit()
            except Exception:
                if self._depth == 1:
                    self.db.rollback()
                raise
            finally:
                self._depth -= 1
                self.quiet = prev

    def _commit(self) -> None:
        if self._depth == 0:
            self.db.commit()

    # ── CRUD ──
    def put(self, key: str, kind: str, scope: str, data: Dict[str, Any]) -> None:
        now = datetime.now().isoformat(timespec="seconds")
        with self.lock:
            self.db.execute(
                "INSERT INTO objects(key,kind,scope,data,created_at,updated_at) VALUES(?,?,?,?,?,?) "
                "ON CONFLICT(key) DO UPDATE SET scope=excluded.scope, data=excluded.data, updated_at=excluded.updated_at",
                (key, kind, scope, _J(data), now, now))
            self._commit()

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        row = self.db.execute("SELECT data FROM objects WHERE key=?", (key,)).fetchone()
        if not row or not row["data"]:
            return None
        try:
            return json.loads(row["data"])
        except Exception:
            return None

    def find(self, kind: str, scope: Optional[str] = None, **where: Any) -> List[Dict[str, Any]]:
        sql, args = "SELECT data FROM objects WHERE kind=?", [kind]
        if scope is not None:
            sql, args = sql + " AND scope=?", args + [scope]
        for field, val in where.items():
            sql, args = sql + f" AND json_extract(data,'$.{field}')=?", args + [val]
        res = []
        for r in self.db.execute(sql + " ORDER BY created_at, key", args):
            try:
                if r["data"]:
                    res.append(json.loads(r["data"]))
            except Exception:
                pass
        return res

    def delete(self, key: str) -> None:
        with self.lock:
            self.db.execute("DELETE FROM objects WHERE key=?", (key,))
            self._commit()

    def delete_where(self, kind: str, scope: str, **where: Any) -> int:
        keys = [r["key"] for r in self.db.execute(
            "SELECT key, data FROM objects WHERE kind=? AND scope=?", (kind, scope))
            if all(json.loads(r["data"]).get(k) == v for k, v in where.items())]
        with self.lock:
            self.db.executemany("DELETE FROM objects WHERE key=?", [(k,) for k in keys])
            self._commit()
        return len(keys)

    def count(self, kind: Optional[str] = None, scope: Optional[str] = None) -> int:
        sql, args = "SELECT COUNT(*) FROM objects WHERE 1=1", []
        for col, val in (("kind", kind), ("scope", scope)):
            if val is not None:
                sql, args = sql + f" AND {col}=?", args + [val]
        return self.db.execute(sql, args).fetchone()[0]

    # ── 연상 검색(recall): 공백 분리 토큰 점수제 (토큰이 많이 맞을수록 상위) ──
    def search(self, text: str, kinds: Optional[List[str]] = None, scope: Optional[str] = None,
               limit: int = 20) -> List[Dict[str, Any]]:
        tokens = [t.lower() for t in text.split() if t.strip()]
        if not tokens:
            return []
        sql, args = "SELECT key, kind, scope, data FROM objects WHERE (" + " OR ".join(["lower(data) LIKE ?"] * len(tokens)) + ")", [f"%{t}%" for t in tokens]
        if kinds:
            sql, args = sql + f" AND kind IN ({','.join('?' * len(kinds))})", args + list(kinds)
        if scope:
            sql, args = sql + " AND scope=?", args + [scope]
        hits = []
        for r in self.db.execute(sql, args):
            low = r["data"].lower()
            hits.append((sum(t in low for t in tokens), {"key": r["key"], "kind": r["kind"], "scope": r["scope"], "data": json.loads(r["data"])}))
        hits.sort(key=lambda h: -h[0])
        return [h[1] for h in hits[:limit]]

    # ── 타임라인(사건 기록) ──
    def log(self, kind: str, obj_key: str, scope: str, action: str, actor: str, detail: Any = None) -> None:
        if self.quiet:
            return
        with self.lock:
            self.db.execute("INSERT INTO events(at,kind,obj_key,scope,action,actor,detail) VALUES(?,?,?,?,?,?,?)",
                            (datetime.now().isoformat(timespec="seconds"), kind, obj_key, scope, action, actor, _J(detail or {})))
            self._commit()

    def timeline(self, scope: Optional[str] = None, obj_key: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        sql, args = "SELECT * FROM events WHERE 1=1", []
        for col, val in (("scope", scope), ("obj_key", obj_key)):
            if val:
                sql, args = sql + f" AND {col}=?", args + [val]
        rows = self.db.execute(sql + " ORDER BY seq DESC LIMIT ?", args + [limit]).fetchall()
        return [{**dict(r), "detail": json.loads(r["detail"] or "{}")} for r in rows]

    def dump(self, scope: str) -> List[Dict[str, Any]]:
        """한 소속(예: 건물)의 모든 객체를 이식 가능한 목록으로 내보내기"""
        return [{"key": r["key"], "kind": r["kind"], "scope": r["scope"], "data": json.loads(r["data"])}
                for r in self.db.execute("SELECT * FROM objects WHERE scope=? ORDER BY created_at, key", (scope,))]

    def close(self) -> None:
        """데이터베이스 연결 명시적 해제"""
        with self.lock:
            try:
                self.db.close()
            except Exception:
                pass

