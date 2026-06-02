"""GET /api/report/{idempresa}/{periodo} — breakdowns for the auditor report generator."""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Path

from api.models import ReportBundleOut
from auth.dependencies import assert_empresa_access, get_current_user
from auth.models import User
from db.queries.cierre import fetch_almacen_shrinkage, fetch_category_shrinkage
from engine.brief import build_audit_brief
from mcp_server.cache import get_or_build_cierre_report

log = logging.getLogger("api.report")

router = APIRouter(prefix="/api", tags=["report"])

_PERIODO_RE = re.compile(r"^\d{4}-\d{2}$")


def _category_rows(idempresa: int, periodo: str) -> list[dict]:
    df = fetch_category_shrinkage(idempresa, periodo)
    if df.empty:
        return []
    total = float(df["total_merma_mxn"].sum() or 0.0)
    rows = []
    for _, r in df.iterrows():
        merma = float(r["total_merma_mxn"] or 0.0)
        rows.append(
            {
                "categoria": str(r["categoria"]),
                "total_merma_mxn": merma,
                "pct_del_total": (merma / total) if total > 0 else 0.0,
                "num_productos": int(r["num_productos"] or 0),
            }
        )
    return rows


def _almacen_rows(idempresa: int, periodo: str) -> list[dict]:
    df = fetch_almacen_shrinkage(idempresa, periodo)
    if df.empty:
        return []
    total = float(df["total_merma_mxn"].sum() or 0.0)
    rows = []
    for _, r in df.iterrows():
        merma = float(r["total_merma_mxn"] or 0.0)
        rows.append(
            {
                "idalmacen": int(r["idalmacen"]),
                "almacen": str(r["almacen"]),
                "total_merma_mxn": merma,
                "pct_del_total": (merma / total) if total > 0 else 0.0,
                "num_productos": int(r["num_productos"] or 0),
                "num_lineas": int(r["num_lineas"] or 0),
            }
        )
    return rows


@router.get("/report/{idempresa}/{periodo}", response_model=ReportBundleOut)
def get_report_bundle(
    idempresa: int = Path(ge=1),
    periodo: str = Path(min_length=7, max_length=7),
    user: User = Depends(get_current_user),
) -> ReportBundleOut:
    assert_empresa_access(user, idempresa)
    if not _PERIODO_RE.match(periodo):
        raise HTTPException(
            status_code=400,
            detail="periodo must be 'YYYY-MM' (e.g. 2025-12)",
        )

    try:
        report = get_or_build_cierre_report(idempresa, periodo, top_n=100)
    except Exception as exc:  # noqa: BLE001
        log.exception("report bundle failed: empresa=%s periodo=%s", idempresa, periodo)
        raise HTTPException(status_code=503, detail=f"engine_error: {exc}") from exc

    if report.kpis.num_lineas == 0:
        raise HTTPException(
            status_code=404,
            detail=f"no_data: sin inventarios finalizados para empresa {idempresa} en {periodo}",
        )

    brief = build_audit_brief(report)
    severity: dict[str, int] = {}
    for a in report.top_anomalies:
        severity[a.severity_label] = severity.get(a.severity_label, 0) + 1

    return ReportBundleOut(
        idempresa=idempresa,
        periodo=periodo,
        generated_at=report.generated_at,
        brief=brief,
        category_breakdown=_category_rows(idempresa, periodo),
        almacen_breakdown=_almacen_rows(idempresa, periodo),
        severity_counts=severity,
    )
