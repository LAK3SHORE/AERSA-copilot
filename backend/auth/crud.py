"""User lookups against analytics.db."""
from __future__ import annotations

from sqlalchemy import text

from auth.models import Role, User
from db.analytics_db import analytics_session_scope


def _row_to_user(row: dict) -> User:
    return User(
        id=int(row["id"]),
        username=str(row["username"]),
        role=Role(str(row["role"])),
        idempresa=int(row["idempresa"]) if row["idempresa"] is not None else None,
    )


def get_user_by_username(username: str) -> tuple[User, str] | None:
    """Return (User, password_hash) or None."""
    with analytics_session_scope() as session:
        row = (
            session.execute(
                text(
                    """
                    SELECT id, username, password_hash, role, idempresa
                    FROM users
                    WHERE username = :username
                    """
                ),
                {"username": username},
            )
            .mappings()
            .first()
        )
    if row is None:
        return None
    user = _row_to_user(dict(row))
    return user, str(row["password_hash"])


def get_user_by_id(user_id: int) -> User | None:
    with analytics_session_scope() as session:
        row = (
            session.execute(
                text(
                    """
                    SELECT id, username, role, idempresa
                    FROM users
                    WHERE id = :id
                    """
                ),
                {"id": user_id},
            )
            .mappings()
            .first()
        )
    if row is None:
        return None
    return _row_to_user(dict(row))
