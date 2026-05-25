"""GET /api/cierre/{idempresa}/{periodo} — full CierreReport (CLAUDE.md 9.3).

Triggers the analytical engine through the TTL-cached accessor in
`mcp_server.cache`. First call for a given (empresa, periodo) takes ~5s;
subsequent calls within `CIERRE_CACHE_TTL_SECONDS` are sub-10ms.
"""
from __future__ import annotations

import logging
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from analytics.findings import get_statuses_for_lines
from analytics.logging import log_event, start_session
from api.models import CierreReportOut
from auth.dependencies import assert_empresa_access, get_current_user
from auth.models import User
from mcp_server.cache import get_or_build_cierre_report

log = logging.getLogger("api.cierre")

router = APIRouter(prefix="/api", tags=["cierre"])

_PERIODO_RE = re.compile(r"^\d{4}-\d{2}$")


@router.get("/cierre/{idempresa}/{periodo}", response_model=CierreReportOut)
def get_cierre(
    idempresa: int = Path(ge=1),
    periodo: str = Path(min_length=7, max_length=7),
    top_n: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
) -> CierreReportOut:
    assert_empresa_access(user, idempresa)
    if not _PERIODO_RE.match(periodo):
        raise HTTPException(
            status_code=400,
            detail="periodo must be 'YYYY-MM' (e.g. 2025-12)",
        )

    t0 = time.perf_counter()
    try:
        report = get_or_build_cierre_report(idempresa, periodo, top_n=top_n)
    except Exception as exc:  # noqa: BLE001
        log.exception("cierre build failed: empresa=%s periodo=%s", idempresa, periodo)
        raise HTTPException(status_code=503, detail=f"engine_error: {exc}") from exc

    elapsed_ms = (time.perf_counter() - t0) * 1000
    log.info(
        "api.cierre empresa=%s periodo=%s anomalies=%d elapsed_ms=%.1f",
        idempresa,
        periodo,
        report.total_anomalies_found,
        elapsed_ms,
    )

    if report.kpis.num_lineas == 0:
        raise HTTPException(
            status_code=404,
            detail=f"no_data: sin inventarios finalizados para empresa {idempresa} en {periodo}",
        )

    session_id = start_session(user.id, idempresa, periodo)
    log_event(
        session_id,
        user.id,
        "cierre_load",
        {"idempresa": idempresa, "periodo": periodo},
    )

    payload = report.to_dict()
    line_ids = [a["idinventariomesdetalle"] for a in payload.get("top_anomalies", [])]
    statuses = get_statuses_for_lines(line_ids)
    payload["audit_session_id"] = session_id
    payload["finding_statuses"] = statuses
    return CierreReportOut.model_validate(payload)
