"""Audit session + client-side event logging (Session 10)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from analytics.logging import end_session, log_event
from auth.dependencies import get_current_user
from auth.models import User

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class LogEventIn(BaseModel):
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class EndSessionIn(BaseModel):
    duration_seconds: int | None = None


@router.post("/{session_id}/events")
def post_session_event(
    session_id: int,
    body: LogEventIn,
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    from analytics.logging import get_session_row

    row = get_session_row(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    if int(row["user_id"]) != user.id:
        raise HTTPException(status_code=403, detail="session_not_owned")
    try:
        log_event(session_id, user.id, body.event_type, body.payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "session_id": session_id}


@router.post("/{session_id}/end")
def post_session_end(
    session_id: int,
    body: EndSessionIn | None = None,
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    from analytics.logging import get_session_row

    row = get_session_row(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    if int(row["user_id"]) != user.id:
        raise HTTPException(status_code=403, detail="session_not_owned")
    dur = body.duration_seconds if body else None
    log_event(
        session_id,
        user.id,
        "session_end",
        {"duration_seconds": dur} if dur is not None else {},
    )
    end_session(session_id, duration_s=dur)
    return {"ok": True, "session_id": session_id}
