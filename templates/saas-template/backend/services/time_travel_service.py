"""
templates/saas-template/backend/services/time_travel_service.py
이벤트 소싱 기반 타임머신 롤백 및 감사 로그 엔진 (Audit & Time-Travel Rollback Engine).

[목적]
- 일반 사용자 실수 방지를 위해 실 서비스 앱(rent2 등)에서는 비활성화하고,
  필요한 엔터프라이즈/고급 관리자용 앱 개발 시 재사용할 수 있도록 SaaS 템플릿에 보존합니다.

[주요 기능]
1. Snapshot-on-Write: 데이터 변경 시 직전 상태(before_data)를 이벤트에 스냅샷으로 영구 보관.
2. Undo (마지막 작업 즉각 취소): 직전 액션을 실행 취소하여 즉시 이전 상태로 복구.
3. Point-in-Time Rollback (특정 시점 복원): 특정 이벤트 번호(seq) 또는 시각으로 객체 상태 롤백.
4. Safe Rollback Guarantee: 롤백 작업 자체도 새로운 이벤트('rollback')로 기록하여 역방향 감사 가능.
"""
import json
import sqlite3
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional


class TimeTravelRollbackEngine:
    """
    이벤트 로그와 객체 스냅샷을 이용한 시점 복원/롤백 전문 서비스 엔진.
    """

    def __init__(self, db_conn: sqlite3.Connection, lock: Optional[threading.RLock] = None):
        self.db = db_conn
        self.lock = lock or threading.RLock()
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        with self.lock:
            self.db.executescript("""
                CREATE TABLE IF NOT EXISTS audit_events (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    at TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    obj_key TEXT NOT NULL,
                    scope TEXT NOT NULL DEFAULT '',
                    action TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    before_data TEXT,
                    after_data TEXT,
                    detail TEXT
                );
                CREATE INDEX IF NOT EXISTS ix_audit_events_key ON audit_events(obj_key);
                CREATE INDEX IF NOT EXISTS ix_audit_events_scope ON audit_events(scope);
            """)
            self.db.commit()

    def log_change(
        self,
        kind: str,
        obj_key: str,
        scope: str,
        action: str,
        actor: str,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        detail: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        데이터 변경 시 전/후 스냅샷과 함께 감사 로그를 영구 기록합니다.
        """
        now = datetime.now().isoformat(timespec="seconds")
        b_str = json.dumps(before_data, ensure_ascii=False, default=str) if before_data else None
        a_str = json.dumps(after_data, ensure_ascii=False, default=str) if after_data else None
        d_str = json.dumps(detail or {}, ensure_ascii=False, default=str)

        with self.lock:
            cur = self.db.execute(
                "INSERT INTO audit_events(at, kind, obj_key, scope, action, actor, before_data, after_data, detail) "
                "VALUES(?,?,?,?,?,?,?,?,?)",
                (now, kind, obj_key, scope, action, actor, b_str, a_str, d_str)
            )
            self.db.commit()
            return cur.lastrowid

    def undo_last_action(self, obj_key: str, actor: str = "admin") -> Dict[str, Any]:
        """
        특정 객체의 가장 최근 변경 작업을 즉시 직전 상태로 취소(Undo)합니다.
        """
        with self.lock:
            row = self.db.execute(
                "SELECT * FROM audit_events WHERE obj_key=? AND before_data IS NOT NULL ORDER BY seq DESC LIMIT 1",
                (obj_key,)
            ).fetchone()

            if not row:
                raise ValueError(f"객체 [{obj_key}]의 되돌릴 수 있는 이전 변경 이력이 없습니다.")

            prev_data = json.loads(row["before_data"])
            now = datetime.now().isoformat(timespec="seconds")

            # 대상 objects 테이블에 이전 데이터 원복 반영
            self.db.execute(
                "UPDATE objects SET data=?, updated_at=? WHERE key=?",
                (json.dumps(prev_data, ensure_ascii=False, default=str), now, obj_key)
            )

            # 롤백 자체를 감사 로그에 기록
            self.log_change(
                kind=row["kind"],
                obj_key=obj_key,
                scope=row["scope"],
                action="undo_rollback",
                actor=actor,
                before_data=json.loads(row["after_data"]) if row["after_data"] else None,
                after_data=prev_data,
                detail={"undone_seq": row["seq"], "original_action": row["action"]}
            )

            self.db.commit()
            return {
                "success": True,
                "obj_key": obj_key,
                "undone_action": row["action"],
                "restored_at": row["at"],
                "restored_data": prev_data
            }

    def rollback_to_seq(self, obj_key: str, target_seq: int, actor: str = "admin") -> Dict[str, Any]:
        """
        특정 이벤트 시점(target_seq)의 상태로 객체를 롤백합니다.
        """
        with self.lock:
            row = self.db.execute(
                "SELECT * FROM audit_events WHERE obj_key=? AND seq=?",
                (obj_key, target_seq)
            ).fetchone()

            if not row or not row["after_data"]:
                raise ValueError(f"유효한 복원 지점 이벤트(seq: {target_seq})를 찾을 수 없습니다.")

            target_data = json.loads(row["after_data"])
            now = datetime.now().isoformat(timespec="seconds")

            self.db.execute(
                "UPDATE objects SET data=?, updated_at=? WHERE key=?",
                (json.dumps(target_data, ensure_ascii=False, default=str), now, obj_key)
            )

            self.log_change(
                kind=row["kind"],
                obj_key=obj_key,
                scope=row["scope"],
                action="point_in_time_rollback",
                actor=actor,
                after_data=target_data,
                detail={"restored_to_seq": target_seq, "target_event_at": row["at"]}
            )

            self.db.commit()
            return {
                "success": True,
                "obj_key": obj_key,
                "target_seq": target_seq,
                "restored_data": target_data
            }

    def list_history(self, obj_key: str, limit: int = 30) -> List[Dict[str, Any]]:
        """
        객체의 전체 변경 히스토리 및 복원 가능 지점 목록을 반환합니다.
        """
        with self.lock:
            rows = self.db.execute(
                "SELECT seq, at, kind, obj_key, scope, action, actor, detail, "
                "(before_data IS NOT NULL) AS can_undo FROM audit_events "
                "WHERE obj_key=? ORDER BY seq DESC LIMIT ?",
                (obj_key, limit)
            ).fetchall()

            return [
                {
                    "seq": r["seq"],
                    "at": r["at"],
                    "kind": r["kind"],
                    "action": r["action"],
                    "actor": r["actor"],
                    "can_undo": bool(r["can_undo"]),
                    "detail": json.loads(r["detail"] or "{}")
                }
                for r in rows
            ]
