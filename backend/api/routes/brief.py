"""GET /api/brief — guided audit briefing (Session 11)."""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from analytics.logging import log_event
from auth.dependencies import assert_empresa_access, get_current_user
from auth.models import User
from engine.brief import build_audit_brief
from mcp_server.cache import get_or_build_cierre_report

log = logging.getLogger("api.brief")

router = APIRouter(prefix="/api", tags=["brief"])

_PERIODO_RE = re.compile(r"^\d{4}-\d{2}$")


@router.get("/brief/{idempresa}/{periodo}")
def get_brief(
    idempresa: int = Path(ge=1),
    periodo: str = Path(min_length=7, max_length=7),
    session_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
) -> dict:
    assert_empresa_access(user, idempresa)
    if not _PERIODO_RE.match(periodo):
        raise HTTPException(status_code=400, detail="periodo must be YYYY-MM")

    try:
        report = get_or_build_cierre_report(idempresa, periodo)
    except Exception as exc:  # noqa: BLE001
        log.exception("brief build failed")
        raise HTTPException(status_code=503, detail=f"engine_error: {exc}") from exc

    if report.kpis.num_lineas == 0:
        raise HTTPException(status_code=404, detail="no_data")

    brief = build_audit_brief(report)
    if session_id is not None:
        log_event(
            session_id,
            user.id,
            "brief_view",
            {"action_count": brief["action_count"]},
        )
    return brief
