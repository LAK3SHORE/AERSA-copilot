"""Owner-dashboard aggregates + per-session scores (Sessions 10 + 13)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text

from analytics.logging import get_session_events
from analytics.mcp_tracking import tool_counts_for_session
from db.analytics_db import analytics_session_scope

DEEP_TOOLS = frozenset({"get_product_history", "get_category_shrinkage"})
SHALLOW_TOOLS = frozenset({"get_cierre_summary", "get_top_anomalies", "generate_audit_brief"})


def _touched_line_ids(events: list[dict[str, Any]]) -> set[int]:
    touched: set[int] = set()
    for ev in events:
        p = ev.get("payload") or {}
        if ev["event_type"] == "anomaly_click":
            lid = p.get("idinventariomesdetalle")
            if lid is not None:
                touched.add(int(lid))
        elif ev["event_type"] == "finding_status_change":
            lid = p.get("idinventariomesdetalle")
            if lid is not None:
                touched.add(int(lid))
        elif ev["event_type"] == "tool_call" and p.get("tool_name") == "get_product_history":
            # product history implies deep dive on a line when args logged
            pass
    return touched


def coverage_score(session_id: int, critical_alto_ids: list[int]) -> float:
    if not critical_alto_ids:
        return 1.0
    events = get_session_events(session_id)
    touched = _touched_line_ids(events)
    hit = sum(1 for i in critical_alto_ids if i in touched)
    return round(hit / len(critical_alto_ids), 3)


def question_depth_score(session_id: int) -> float:
    counts = tool_counts_for_session(session_id)
    deep = sum(counts.get(t, 0) for t in DEEP_TOOLS)
    shallow = sum(counts.get(t, 0) for t in SHALLOW_TOOLS)
    total = deep + shallow
    if total == 0:
        return 0.0
    return round(deep / total, 3)


def usage_summary(days: int = 30) -> dict[str, Any]:
    with analytics_session_scope() as session:
        by_tool = [
            dict(r)
            for r in session.execute(
                text(
                    """
                    SELECT tool_name,
                           COUNT(*) AS total_calls,
                           CAST(AVG(duration_ms) AS INTEGER) AS avg_duration_ms,
                           COUNT(DISTINCT user_id) AS unique_users,
                           SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS errors
                    FROM mcp_tool_events
                    WHERE created_at >= datetime('now', :offset)
                    GROUP BY tool_name
                    ORDER BY total_calls DESC
                    """
                ),
                {"offset": f"-{int(days)} days"},
            )
            .mappings()
            .all()
        ]
        by_user = [
            dict(r)
            for r in session.execute(
                text(
                    """
                    SELECT e.user_id, u.username, u.role,
                           COUNT(*) AS total_calls,
                           COUNT(DISTINCT e.session_id) AS total_sessions,
                           MAX(e.created_at) AS last_active
                    FROM mcp_tool_events e
                    JOIN users u ON u.id = e.user_id
                    WHERE e.created_at >= datetime('now', :offset)
                    GROUP BY e.user_id, u.username, u.role
                    ORDER BY total_calls DESC
                    """
                ),
                {"offset": f"-{int(days)} days"},
            )
            .mappings()
            .all()
        ]
        daily_trend = [
            dict(r)
            for r in session.execute(
                text(
                    """
                    SELECT date(created_at) AS day,
                           COUNT(*) AS calls,
                           COUNT(DISTINCT user_id) AS active_users
                    FROM mcp_tool_events
                    WHERE created_at >= datetime('now', :offset)
                    GROUP BY day
                    ORDER BY day
                    """
                ),
                {"offset": f"-{int(days)} days"},
            )
            .mappings()
            .all()
        ]
    return {
        "period_days": days,
        "by_tool": by_tool,
        "by_user": by_user,
        "daily_trend": daily_trend,
    }


def sessions_list(limit: int = 50) -> list[dict[str, Any]]:
    with analytics_session_scope() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT s.id, s.user_id, u.username, s.idempresa, s.periodo,
                           s.started_at, s.ended_at, s.duration_s,
                           (SELECT COUNT(*) FROM interaction_logs l WHERE l.session_id = s.id) AS event_count,
                           (SELECT COUNT(*) FROM interaction_logs l
                            WHERE l.session_id = s.id AND l.event_type = 'chat_message') AS chat_messages
                    FROM audit_sessions s
                    JOIN users u ON u.id = s.user_id
                    ORDER BY s.started_at DESC
                    LIMIT :limit
                    """
                ),
                {"limit": limit},
            )
            .mappings()
            .all()
        )
    return [dict(r) for r in rows]


def session_detail(session_id: int, critical_alto_ids: list[int] | None = None) -> dict[str, Any] | None:
    from analytics.logging import get_session_row

    row = get_session_row(session_id)
    if row is None:
        return None
    events = get_session_events(session_id)
    tool_counts = tool_counts_for_session(session_id)
    crit = critical_alto_ids or []
    cov = coverage_score(session_id, crit) if crit else None
    depth = question_depth_score(session_id)
    return {
        **row,
        "events": events,
        "tool_counts": tool_counts,
        "coverage_score": cov,
        "question_depth_score": depth,
        "chat_messages": sum(1 for e in events if e["event_type"] == "chat_message"),
    }


def aggregate_overview(days: int = 30) -> dict[str, Any]:
    usage = usage_summary(days)
    with analytics_session_scope() as session:
        totals = session.execute(
            text(
                """
                SELECT
                    (SELECT COUNT(*) FROM audit_sessions
                     WHERE started_at >= datetime('now', :offset)) AS total_sessions,
                    (SELECT COUNT(DISTINCT user_id) FROM audit_sessions
                     WHERE started_at >= datetime('now', :offset)
                       AND user_id IN (SELECT id FROM users WHERE role = 'auditor')) AS active_auditors,
                    (SELECT COUNT(*) FROM interaction_logs l
                     JOIN audit_sessions s ON s.id = l.session_id
                     WHERE l.event_type = 'chat_message'
                       AND s.started_at >= datetime('now', :offset)) AS total_chat_messages
                """
            ),
            {"offset": f"-{int(days)} days"},
        ).mappings().first()
        sessions_by_week = [
            dict(r)
            for r in session.execute(
                text(
                    """
                    SELECT strftime('%Y-W%W', started_at) AS week,
                           COUNT(*) AS sessions
                    FROM audit_sessions
                    WHERE started_at >= datetime('now', :offset)
                    GROUP BY week
                    ORDER BY week
                    """
                ),
                {"offset": f"-{int(days)} days"},
            )
            .mappings()
            .all()
        ]
    total_sessions = int(totals["total_sessions"] or 0)
    chat_msgs = int(totals["total_chat_messages"] or 0)
    avg_questions = round(chat_msgs / total_sessions, 2) if total_sessions else 0.0

    return {
        "period_days": days,
        "total_sessions": total_sessions,
        "active_auditors": int(totals["active_auditors"] or 0),
        "avg_questions_per_session": avg_questions,
        "tool_distribution": usage["by_tool"],
        "sessions_by_week": sessions_by_week,
        "daily_trend": usage["daily_trend"],
    }


def usage_by_empresa(days: int = 30) -> list[dict[str, Any]]:
    """Aggregate MCP + session activity per idempresa (for corporativo dashboard)."""
    offset = f"-{int(days)} days"
    with analytics_session_scope() as session:
        tool_rows = (
            session.execute(
                text(
                    """
                    SELECT idempresa,
                           COUNT(*) AS tool_calls,
                           COUNT(DISTINCT user_id) AS auditors_using_tools,
                           COUNT(DISTINCT session_id) AS sessions_with_tools
                    FROM mcp_tool_events
                    WHERE idempresa IS NOT NULL
                      AND created_at >= datetime('now', :offset)
                    GROUP BY idempresa
                    ORDER BY tool_calls DESC
                    """
                ),
                {"offset": offset},
            )
            .mappings()
            .all()
        )
        session_rows = (
            session.execute(
                text(
                    """
                    SELECT s.idempresa,
                           COUNT(*) AS audit_sessions,
                           COUNT(DISTINCT s.user_id) AS auditors
                    FROM audit_sessions s
                    WHERE s.started_at >= datetime('now', :offset)
                    GROUP BY s.idempresa
                    ORDER BY audit_sessions DESC
                    """
                ),
                {"offset": offset},
            )
            .mappings()
            .all()
        )
        chat_rows = (
            session.execute(
                text(
                    """
                    SELECT s.idempresa, COUNT(*) AS chat_messages
                    FROM interaction_logs l
                    JOIN audit_sessions s ON l.session_id = s.id
                    WHERE l.event_type = 'chat_message'
                      AND l.created_at >= datetime('now', :offset)
                    GROUP BY s.idempresa
                    """
                ),
                {"offset": offset},
            )
            .mappings()
            .all()
        )

    by_id: dict[int, dict[str, Any]] = {}
    for r in session_rows:
        eid = int(r["idempresa"])
        by_id[eid] = {
            "idempresa": eid,
            "audit_sessions": int(r["audit_sessions"] or 0),
            "auditors": int(r["auditors"] or 0),
            "chat_messages": 0,
            "tool_calls": 0,
            "sessions_with_tools": 0,
        }
    for r in chat_rows:
        eid = int(r["idempresa"])
        row = by_id.setdefault(
            eid,
            {
                "idempresa": eid,
                "audit_sessions": 0,
                "auditors": 0,
                "chat_messages": 0,
                "tool_calls": 0,
                "sessions_with_tools": 0,
            },
        )
        row["chat_messages"] = int(r["chat_messages"] or 0)
    for r in tool_rows:
        eid = int(r["idempresa"])
        row = by_id.setdefault(
            eid,
            {
                "idempresa": eid,
                "audit_sessions": 0,
                "auditors": 0,
                "chat_messages": 0,
                "tool_calls": 0,
                "sessions_with_tools": 0,
            },
        )
        row["tool_calls"] = int(r["tool_calls"] or 0)
        row["sessions_with_tools"] = int(r["sessions_with_tools"] or 0)
        row["auditors"] = max(row["auditors"], int(r["auditors_using_tools"] or 0))

    return sorted(by_id.values(), key=lambda x: x["tool_calls"], reverse=True)


def dashboard_bundle(days: int = 30) -> dict[str, Any]:
    """Single payload for corporativo admin dashboard + copilot context."""
    overview = aggregate_overview(days)
    usage = usage_summary(days)
    by_tool = list(usage["by_tool"])
    total_tool_calls = sum(int(t.get("total_calls") or 0) for t in by_tool)
    most_used = by_tool[0] if by_tool else None
    least_used = by_tool[-1] if len(by_tool) > 1 else (by_tool[0] if by_tool else None)

    by_empresa = usage_by_empresa(days)
    auditors = [u for u in usage["by_user"] if str(u.get("role")) == "auditor"]

    return {
        "period_days": days,
        "overview": {
            "total_sessions": overview["total_sessions"],
            "active_auditors": overview["active_auditors"],
            "avg_questions_per_session": overview["avg_questions_per_session"],
            "total_tool_calls": total_tool_calls,
            "distinct_tools": len(by_tool),
        },
        "tools": {
            "total_calls": total_tool_calls,
            "ranking": by_tool,
            "most_used": most_used,
            "least_used": least_used,
        },
        "by_empresa": by_empresa,
        "by_auditor": auditors,
        "daily_trend": usage["daily_trend"],
        "recent_sessions": sessions_list(limit=25),
    }


def auditor_detail(user_id: int, days: int = 30) -> dict[str, Any]:
    with analytics_session_scope() as session:
        user_row = (
            session.execute(
                text("SELECT id, username, role, idempresa FROM users WHERE id = :id"),
                {"id": user_id},
            )
            .mappings()
            .first()
        )
        if user_row is None:
            return {"error": "not_found", "message": "Usuario no encontrado"}
        by_tool = [
            dict(r)
            for r in session.execute(
                text(
                    """
                    SELECT tool_name, COUNT(*) AS calls,
                           CAST(AVG(duration_ms) AS INTEGER) AS avg_duration_ms
                    FROM mcp_tool_events
                    WHERE user_id = :uid
                      AND created_at >= datetime('now', :offset)
                    GROUP BY tool_name
                    ORDER BY calls DESC
                    """
                ),
                {"uid": user_id, "offset": f"-{int(days)} days"},
            )
            .mappings()
            .all()
        ]
        recent_sessions = [
            dict(r)
            for r in session.execute(
                text(
                    """
                    SELECT id, idempresa, periodo, started_at, ended_at, duration_s
                    FROM audit_sessions
                    WHERE user_id = :uid
                      AND started_at >= datetime('now', :offset)
                    ORDER BY started_at DESC
                    LIMIT 20
                    """
                ),
                {"uid": user_id, "offset": f"-{int(days)} days"},
            )
            .mappings()
            .all()
        ]
    return {
        "user": dict(user_row),
        "period_days": days,
        "by_tool": by_tool,
        "recent_sessions": recent_sessions,
    }
