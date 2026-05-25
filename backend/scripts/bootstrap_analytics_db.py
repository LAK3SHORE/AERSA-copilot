"""Create analytics.db tables (Sessions 9–12).

Idempotent — safe to re-run.
"""
from __future__ import annotations

from sqlalchemy import text

from db.analytics_db import analytics_engine

DDL = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK(role IN ('auditor', 'corporativo')),
    idempresa     INTEGER,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auditor_empresa
    ON users(idempresa)
    WHERE role = 'auditor' AND idempresa IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    idempresa   INTEGER NOT NULL,
    periodo     TEXT NOT NULL,
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at    TEXT,
    duration_s  INTEGER
);

CREATE TABLE IF NOT EXISTS interaction_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES audit_sessions(id),
    user_id     INTEGER NOT NULL REFERENCES users(id),
    event_type  TEXT NOT NULL,
    payload     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_tool_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    session_id  INTEGER REFERENCES audit_sessions(id),
    idempresa   INTEGER,
    periodo     TEXT,
    tool_name   TEXT    NOT NULL,
    duration_ms INTEGER,
    success     INTEGER NOT NULL DEFAULT 1,
    error_msg   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mcp_events_user
    ON mcp_tool_events (user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_events_tool
    ON mcp_tool_events (tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_events_created
    ON mcp_tool_events (created_at);

CREATE TABLE IF NOT EXISTS finding_status (
    idinventariomesdetalle  INTEGER PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id),
    status                  TEXT NOT NULL CHECK(status IN ('pendiente','revisado','escalado')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def bootstrap() -> None:
    with analytics_engine.begin() as conn:
        for stmt in DDL.strip().split(";"):
            s = stmt.strip()
            if s:
                conn.execute(text(s))
    print(
        "[bootstrap_analytics_db] OK — users, audit_sessions, "
        "interaction_logs, mcp_tool_events, finding_status"
    )


if __name__ == "__main__":
    bootstrap()
