"""`get_cierre_summary` MCP tool (CLAUDE.md 7.2 tool 1).

Returns the top-level KPI summary for a Cierre de Semana. The LLM uses
this for "overview" questions: totals, num almacenes, top problem category.
"""
from __future__ import annotations

from dataclasses import asdict

from mcp_server.cache import get_or_build_cierre_report
from mcp_server.tools._errors import db_error, error


def get_cierre_summary(idempresa: int, periodo: str) -> dict:
    """KPI summary + data-quality warnings for (empresa, periodo)."""
    try:
        report = get_or_build_cierre_report(idempresa, periodo)
    except Exception as exc:  # noqa: BLE001 — funnel all DB errors to one envelope
        return db_error(exc)

    if report.kpis.num_lineas == 0:
        return error(
            "no_data",
            f"No hay inventarios finalizados para empresa {idempresa} en {periodo}.",
        )

    return {
        "kpis": asdict(report.kpis),
        "total_anomalies_found": report.total_anomalies_found,
        "generated_at": report.generated_at,
        "data_quality_warnings": report.data_quality_warnings,
    }


__all__ = ["get_cierre_summary"]
