"""Dual-write MCP tool metrics to mcp_tool_events + interaction_logs (Session 10)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text

from analytics.logging import log_event
from db.analytics_db import analytics_session_scope


def record_tool_event(
    *,
    user_id: int,
    session_id: int | None,
    tool_name: str,
    duration_ms: int,
    success: bool,
    error_msg: str | None = None,
    idempresa: int | None = None,
    periodo: str | None = None,
) -> None:
    payload = {"tool_name": tool_name, "elapsed_ms": duration_ms}
    if session_id is not None:
        log_event(session_id, user_id, "tool_call", payload)

    with analytics_session_scope() as session:
        session.execute(
            text(
                """
                INSERT INTO mcp_tool_events (
                    user_id, session_id, idempresa, periodo,
                    tool_name, duration_ms, success, error_msg
                )
                VALUES (
                    :user_id, :session_id, :idempresa, :periodo,
                    :tool_name, :duration_ms, :success, :error_msg
                )
                """
            ),
            {
                "user_id": user_id,
                "session_id": session_id,
                "idempresa": idempresa,
                "periodo": periodo,
                "tool_name": tool_name,
                "duration_ms": duration_ms,
                "success": 1 if success else 0,
                "error_msg": error_msg,
            },
        )


def tool_counts_for_session(session_id: int) -> dict[str, int]:
    with analytics_session_scope() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT tool_name, COUNT(*) AS n
                    FROM mcp_tool_events
                    WHERE session_id = :session_id
                    GROUP BY tool_name
                    """
                ),
                {"session_id": session_id},
            )
            .mappings()
            .all()
        )
    return {str(r["tool_name"]): int(r["n"]) for r in rows}
