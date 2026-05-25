"""Audit session lifecycle + interaction_logs (Session 10)."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from db.analytics_db import analytics_session_scope

EVENT_TYPES = frozenset({
    "cierre_load",
    "brief_view",
    "chat_message",
    "tool_call",
    "anomaly_click",
    "finding_status_change",
    "session_end",
})


def start_session(user_id: int, idempresa: int, periodo: str) -> int:
    with analytics_session_scope() as session:
        session.execute(
            text(
                """
                INSERT INTO audit_sessions (user_id, idempresa, periodo)
                VALUES (:user_id, :idempresa, :periodo)
                """
            ),
            {"user_id": user_id, "idempresa": idempresa, "periodo": periodo},
        )
        sid = session.execute(text("SELECT last_insert_rowid()")).scalar_one()
        return int(sid)


def end_session(session_id: int, duration_s: int | None = None) -> None:
    with analytics_session_scope() as session:
        session.execute(
            text(
                """
                UPDATE audit_sessions
                SET ended_at = datetime('now'),
                    duration_s = COALESCE(:duration_s, duration_s)
                WHERE id = :id AND ended_at IS NULL
                """
            ),
            {"id": session_id, "duration_s": duration_s},
        )


def log_event(
    session_id: int,
    user_id: int,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> int:
    if event_type not in EVENT_TYPES:
        raise ValueError(f"unknown event_type: {event_type}")
    blob = json.dumps(payload or {}, ensure_ascii=False, default=str)
    with analytics_session_scope() as session:
        session.execute(
            text(
                """
                INSERT INTO interaction_logs (session_id, user_id, event_type, payload)
                VALUES (:session_id, :user_id, :event_type, :payload)
                """
            ),
            {
                "session_id": session_id,
                "user_id": user_id,
                "event_type": event_type,
                "payload": blob,
            },
        )
        return int(session.execute(text("SELECT last_insert_rowid()")).scalar_one())


def get_session_row(session_id: int) -> dict[str, Any] | None:
    with analytics_session_scope() as session:
        row = (
            session.execute(
                text(
                    """
                    SELECT s.id, s.user_id, s.idempresa, s.periodo,
                           s.started_at, s.ended_at, s.duration_s,
                           u.username, u.role
                    FROM audit_sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.id = :id
                    """
                ),
                {"id": session_id},
            )
            .mappings()
            .first()
        )
    return dict(row) if row else None


def get_session_events(session_id: int) -> list[dict[str, Any]]:
    with analytics_session_scope() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, event_type, payload, created_at
                    FROM interaction_logs
                    WHERE session_id = :session_id
                    ORDER BY created_at ASC
                    """
                ),
                {"session_id": session_id},
            )
            .mappings()
            .all()
        )
    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        try:
            d["payload"] = json.loads(d["payload"] or "{}")
        except json.JSONDecodeError:
            d["payload"] = {}
        out.append(d)
    return out
