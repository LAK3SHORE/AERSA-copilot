"""Owner analytics routes — corporativo only (Sessions 10 + 13)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from analytics.metrics import (
    aggregate_overview,
    auditor_detail,
    dashboard_bundle,
    session_detail,
    sessions_list,
    usage_summary,
)
from auth.dependencies import require_corporativo
from auth.models import User
from mcp_server.cache import get_or_build_cierre_report

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _critical_alto_ids(idempresa: int, periodo: str) -> list[int]:
    try:
        report = get_or_build_cierre_report(idempresa, periodo)
    except Exception:  # noqa: BLE001
        return []
    return [
        a.idinventariomesdetalle
        for a in report.top_anomalies
        if a.severity_label in ("CRÍTICO", "ALTO")
    ]


@router.get("/dashboard")
def analytics_dashboard(
    days: int = Query(30, ge=1, le=365),
    _user: User = Depends(require_corporativo),
) -> dict:
    """Consolidated KPIs for corporativo admin panel + copilot context."""
    return dashboard_bundle(days)


@router.get("/overview")
def analytics_overview(
    days: int = Query(30, ge=1, le=365),
    _user: User = Depends(require_corporativo),
) -> dict:
    return aggregate_overview(days)


@router.get("/usage-summary")
def analytics_usage_summary(
    days: int = Query(30, ge=1, le=365),
    _user: User = Depends(require_corporativo),
) -> dict:
    return usage_summary(days)


@router.get("/sessions")
def analytics_sessions(
    limit: int = Query(50, ge=1, le=200),
    _user: User = Depends(require_corporativo),
) -> dict:
    rows = sessions_list(limit=limit)
    return {"sessions": rows, "count": len(rows)}


@router.get("/sessions/{session_id}")
def analytics_session_by_id(
    session_id: int,
    _user: User = Depends(require_corporativo),
) -> dict:
    from analytics.logging import get_session_row

    row = get_session_row(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    crit = _critical_alto_ids(int(row["idempresa"]), str(row["periodo"]))
    detail = session_detail(session_id, critical_alto_ids=crit)
    if detail is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    return detail


@router.get("/auditor/{user_id}")
def analytics_auditor(
    user_id: int,
    days: int = Query(30, ge=1, le=365),
    _user: User = Depends(require_corporativo),
) -> dict:
    data = auditor_detail(user_id, days)
    if data.get("error") == "not_found":
        raise HTTPException(status_code=404, detail=data["message"])
    return data
