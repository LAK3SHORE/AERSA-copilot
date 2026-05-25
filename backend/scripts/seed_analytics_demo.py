"""Seed rich analytics demo data for the corporativo dashboard.

Wipes activity tables (sessions, logs, MCP events) and repopulates ~30 days
of realistic usage. Users are upserted; finding_status is untouched.

    uv run python -m scripts.bootstrap_analytics_db
    uv run python -m scripts.seed_users
    uv run python -m scripts.seed_analytics_demo

Demo auditors (password talos2026, same as auditor_956):
  auditor_941, auditor_956, auditor_1024, auditor_1102
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from auth.password import hash_password
from db.analytics_db import analytics_session_scope
from scripts.bootstrap_analytics_db import bootstrap
from scripts.seed_users import USERS as BASE_USERS

DEMO_TAG = "demo_seed_v1"

DEMO_AUDITORS = [
    {"username": "auditor_941", "password": "talos2026", "role": "auditor", "idempresa": 941},
    {"username": "auditor_956", "password": "talos2026", "role": "auditor", "idempresa": 956},
    {"username": "auditor_1024", "password": "talos2026", "role": "auditor", "idempresa": 1024},
    {"username": "auditor_1102", "password": "talos2026", "role": "auditor", "idempresa": 1102},
]

# (tool_name, relative weight) — drives most/least used KPI story
TOOL_WEIGHTS: list[tuple[str, int]] = [
    ("get_top_anomalies", 62),
    ("get_cierre_summary", 45),
    ("get_product_history", 38),
    ("get_category_shrinkage", 22),
    ("generate_audit_brief", 11),
]

PERIODOS = ["2025-10", "2025-11", "2025-12"]


@dataclass(frozen=True)
class SessionSpec:
    username: str
    idempresa: int
    periodo: str
    days_ago: int
    duration_min: int
    chat_messages: int
    anomaly_clicks: int
    tool_calls: list[str]


def _tools(n: int) -> list[str]:
    """Pick n tools weighted toward popular ones."""
    pool: list[str] = []
    for name, w in TOOL_WEIGHTS:
        pool.extend([name] * w)
    rng = random.Random(42)
    return [rng.choice(pool) for _ in range(n)]


# Curated sessions: empresa 1024 = heavy adopter, 941 = laggard
SESSION_SPECS: list[SessionSpec] = [
    # auditor_1024 — power user
    SessionSpec("auditor_1024", 1024, "2025-12", 1, 42, 8, 4, _tools(14)),
    SessionSpec("auditor_1024", 1024, "2025-12", 3, 35, 6, 3, _tools(11)),
    SessionSpec("auditor_1024", 1024, "2025-11", 8, 28, 5, 2, _tools(9)),
    SessionSpec("auditor_1024", 1024, "2025-11", 14, 22, 4, 2, _tools(8)),
    SessionSpec("auditor_1024", 1024, "2025-10", 22, 18, 3, 1, _tools(6)),
    # auditor_956 — steady
    SessionSpec("auditor_956", 956, "2025-12", 2, 30, 5, 2, _tools(10)),
    SessionSpec("auditor_956", 956, "2025-12", 6, 25, 4, 2, _tools(7)),
    SessionSpec("auditor_956", 956, "2025-11", 11, 20, 3, 1, _tools(6)),
    SessionSpec("auditor_956", 956, "2025-10", 19, 15, 2, 1, _tools(4)),
    # auditor_1102 — ramping up
    SessionSpec("auditor_1102", 1102, "2025-12", 4, 26, 4, 2, _tools(8)),
    SessionSpec("auditor_1102", 1102, "2025-12", 9, 20, 3, 1, _tools(5)),
    SessionSpec("auditor_1102", 1102, "2025-11", 16, 12, 2, 0, _tools(3)),
    # auditor_941 — low adoption
    SessionSpec("auditor_941", 941, "2025-12", 12, 8, 1, 0, ["get_cierre_summary"]),
    SessionSpec("auditor_941", 941, "2025-11", 25, 5, 1, 0, ["get_top_anomalies"]),
]


def _ts(days_ago: int, extra_minutes: int = 0) -> str:
    """UTC timestamp string for SQLite."""
    t = datetime.now(UTC) - timedelta(days=days_ago) + timedelta(minutes=extra_minutes)
    return t.strftime("%Y-%m-%d %H:%M:%S")


def _upsert_users(session) -> dict[str, int]:
    """Return username -> user_id."""
    all_users = list(BASE_USERS) + DEMO_AUDITORS
    seen: set[str] = set()
    unique: list[dict] = []
    for u in all_users:
        if u["username"] in seen:
            continue
        seen.add(u["username"])
        unique.append(u)

    for u in unique:
        session.execute(
            text(
                """
                INSERT INTO users (username, password_hash, role, idempresa)
                VALUES (:username, :password_hash, :role, :idempresa)
                ON CONFLICT(username) DO UPDATE SET
                    password_hash = excluded.password_hash,
                    role = excluded.role,
                    idempresa = excluded.idempresa
                """
            ),
            {
                "username": u["username"],
                "password_hash": hash_password(u["password"]),
                "role": u["role"],
                "idempresa": u["idempresa"],
            },
        )

    rows = session.execute(text("SELECT id, username FROM users")).mappings().all()
    return {str(r["username"]): int(r["id"]) for r in rows}


def _clear_activity(session) -> None:
    session.execute(text("DELETE FROM mcp_tool_events"))
    session.execute(text("DELETE FROM interaction_logs"))
    session.execute(text("DELETE FROM audit_sessions"))


def _insert_session(
    session,
    *,
    user_id: int,
    idempresa: int,
    periodo: str,
    days_ago: int,
    duration_min: int,
) -> int:
    session.execute(
        text(
            """
            INSERT INTO audit_sessions (
                user_id, idempresa, periodo,
                started_at, ended_at, duration_s
            )
            VALUES (
                :user_id, :idempresa, :periodo,
                :started_at, :ended_at, :duration_s
            )
            """
        ),
        {
            "user_id": user_id,
            "idempresa": idempresa,
            "periodo": periodo,
            "started_at": _ts(days_ago, 0),
            "ended_at": _ts(days_ago, duration_min),
            "duration_s": duration_min * 60,
        },
    )
    return int(session.execute(text("SELECT last_insert_rowid()")).scalar_one())


def _insert_log(
    session,
    *,
    session_id: int,
    user_id: int,
    event_type: str,
    days_ago: int,
    minutes_into_session: int,
    extra: dict | None = None,
) -> None:
    payload = {"demo_seed": DEMO_TAG, **(extra or {})}
    session.execute(
        text(
            """
            INSERT INTO interaction_logs (
                session_id, user_id, event_type, payload, created_at
            )
            VALUES (
                :session_id, :user_id, :event_type, :payload, :created_at
            )
            """
        ),
        {
            "session_id": session_id,
            "user_id": user_id,
            "event_type": event_type,
            "payload": json.dumps(payload, ensure_ascii=False),
            "created_at": _ts(days_ago, minutes_into_session),
        },
    )


def _insert_tool(
    session,
    *,
    user_id: int,
    session_id: int,
    idempresa: int,
    periodo: str,
    tool_name: str,
    days_ago: int,
    minutes_into_session: int,
    duration_ms: int,
    success: bool = True,
) -> None:
    session.execute(
        text(
            """
            INSERT INTO mcp_tool_events (
                user_id, session_id, idempresa, periodo,
                tool_name, duration_ms, success, error_msg, created_at
            )
            VALUES (
                :user_id, :session_id, :idempresa, :periodo,
                :tool_name, :duration_ms, :success, :error_msg, :created_at
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
            "error_msg": None if success else "timeout demo",
            "created_at": _ts(days_ago, minutes_into_session),
        },
    )


def seed() -> None:
    bootstrap()
    random.seed(42)

    with analytics_session_scope() as session:
        _clear_activity(session)
        user_ids = _upsert_users(session)

        total_sessions = 0
        total_tools = 0
        total_chats = 0

        for spec in SESSION_SPECS:
            uid = user_ids[spec.username]
            sid = _insert_session(
                session,
                user_id=uid,
                idempresa=spec.idempresa,
                periodo=spec.periodo,
                days_ago=spec.days_ago,
                duration_min=spec.duration_min,
            )
            total_sessions += 1
            minute = 1

            _insert_log(
                session,
                session_id=sid,
                user_id=uid,
                event_type="cierre_load",
                days_ago=spec.days_ago,
                minutes_into_session=minute,
            )
            minute += 1

            if spec.tool_calls and "generate_audit_brief" in spec.tool_calls:
                _insert_log(
                    session,
                    session_id=sid,
                    user_id=uid,
                    event_type="brief_view",
                    days_ago=spec.days_ago,
                    minutes_into_session=minute,
                )
                minute += 1

            for i, tool in enumerate(spec.tool_calls):
                ms = 40 + (i * 17) % 120
                _insert_tool(
                    session,
                    user_id=uid,
                    session_id=sid,
                    idempresa=spec.idempresa,
                    periodo=spec.periodo,
                    tool_name=tool,
                    days_ago=spec.days_ago,
                    minutes_into_session=minute,
                    duration_ms=ms,
                    success=tool != "get_category_shrinkage" or i % 4 != 0,
                )
                _insert_log(
                    session,
                    session_id=sid,
                    user_id=uid,
                    event_type="tool_call",
                    days_ago=spec.days_ago,
                    minutes_into_session=minute,
                    extra={"tool_name": tool, "elapsed_ms": ms},
                )
                minute += 1
                total_tools += 1

            for c in range(spec.chat_messages):
                _insert_log(
                    session,
                    session_id=sid,
                    user_id=uid,
                    event_type="chat_message",
                    days_ago=spec.days_ago,
                    minutes_into_session=minute,
                    extra={"length": 80 + c * 40, "suggested": c == 0},
                )
                minute += 2
                total_chats += 1

            for _ in range(spec.anomaly_clicks):
                _insert_log(
                    session,
                    session_id=sid,
                    user_id=uid,
                    event_type="anomaly_click",
                    days_ago=spec.days_ago,
                    minutes_into_session=minute,
                    extra={
                        "idinventariomesdetalle": 90000000 + spec.idempresa + minute,
                        "severity_label": "ALTO",
                    },
                )
                minute += 1

            _insert_log(
                session,
                session_id=sid,
                user_id=uid,
                event_type="session_end",
                days_ago=spec.days_ago,
                minutes_into_session=spec.duration_min - 1,
            )

        # Extra scattered MCP calls (daily trend + tool ranking depth)
        scatter_user = user_ids["auditor_1024"]
        scatter_tools = [t for t, _ in TOOL_WEIGHTS]
        for day in range(1, 29, 2):
            tool = scatter_tools[day % len(scatter_tools)]
            _insert_tool(
                session,
                user_id=scatter_user,
                session_id=None,
                idempresa=1024,
                periodo="2025-12",
                tool_name=tool,
                days_ago=day,
                minutes_into_session=10,
                duration_ms=55 + day,
            )
            total_tools += 1

    print(
        "[seed_analytics_demo] OK — wiped activity tables and seeded demo usage:\n"
        f"  · {total_sessions} audit sessions across empresas 941, 956, 1024, 1102\n"
        f"  · {total_tools} MCP tool calls (get_top_anomalies most used)\n"
        f"  · {total_chats} chat messages\n"
        "  · Reload corporativo panel (admin / aersa2026)"
    )


if __name__ == "__main__":
    seed()
