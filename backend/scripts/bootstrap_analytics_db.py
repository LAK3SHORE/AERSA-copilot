"""Create analytics.db tables (Session 9: users only).

Session 10 adds audit_sessions, interaction_logs, finding_status, mcp_tool_events.
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
"""


def bootstrap() -> None:
    with analytics_engine.begin() as conn:
        for stmt in DDL.strip().split(";"):
            s = stmt.strip()
            if s:
                conn.execute(text(s))
    print("[bootstrap_analytics_db] OK — users table ready")


if __name__ == "__main__":
    bootstrap()
