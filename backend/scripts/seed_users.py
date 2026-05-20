"""Seed demo users (CLAUDE.md §16.3)."""
from __future__ import annotations

from sqlalchemy import text

from auth.password import hash_password
from db.analytics_db import analytics_session_scope
from scripts.bootstrap_analytics_db import bootstrap

USERS = [
    {
        "username": "admin",
        "password": "aersa2026",
        "role": "corporativo",
        "idempresa": None,
    },
    {
        "username": "auditor_956",
        "password": "talos2026",
        "role": "auditor",
        "idempresa": 956,
    },
]


def seed() -> None:
    bootstrap()
    with analytics_session_scope() as session:
        for u in USERS:
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
    print("[seed_users] OK — admin (corporativo), auditor_956 (empresa 956)")


if __name__ == "__main__":
    seed()
