"""Finding status CRUD (Session 12)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text

from db.analytics_db import analytics_session_scope

VALID_STATUSES = frozenset({"pendiente", "revisado", "escalado"})


def upsert_finding_status(
    user_id: int,
    idinventariomesdetalle: int,
    status: str,
) -> dict[str, Any]:
    if status not in VALID_STATUSES:
        raise ValueError(f"invalid status: {status}")

    with analytics_session_scope() as session:
        old = (
            session.execute(
                text(
                    """
                    SELECT status FROM finding_status
                    WHERE idinventariomesdetalle = :id
                    """
                ),
                {"id": idinventariomesdetalle},
            )
            .scalar()
        )
        session.execute(
            text(
                """
                INSERT INTO finding_status (idinventariomesdetalle, user_id, status, updated_at)
                VALUES (:id, :user_id, :status, datetime('now'))
                ON CONFLICT(idinventariomesdetalle) DO UPDATE SET
                    user_id = excluded.user_id,
                    status = excluded.status,
                    updated_at = datetime('now')
                """
            ),
            {
                "id": idinventariomesdetalle,
                "user_id": user_id,
                "status": status,
            },
        )
    return {
        "idinventariomesdetalle": idinventariomesdetalle,
        "old_status": old,
        "new_status": status,
    }


def get_statuses_for_lines(ids: list[int]) -> dict[int, str]:
    if not ids:
        return {}
    placeholders = ", ".join(f":id{i}" for i in range(len(ids)))
    params = {f"id{i}": v for i, v in enumerate(ids)}
    with analytics_session_scope() as session:
        rows = (
            session.execute(
                text(
                    f"""
                    SELECT idinventariomesdetalle, status
                    FROM finding_status
                    WHERE idinventariomesdetalle IN ({placeholders})
                    """
                ),
                params,
            )
            .mappings()
            .all()
        )
    return {int(r["idinventariomesdetalle"]): str(r["status"]) for r in rows}
