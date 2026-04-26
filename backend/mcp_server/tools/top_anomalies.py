"""`get_top_anomalies` MCP tool (CLAUDE.md 7.2 tool 2).

Returns the top-N anomalous inventory lines ranked by composite priority
score (severity + financial impact + recurrence, 6.3).
"""
from __future__ import annotations

from dataclasses import asdict

from engine.report import CierreReport
from mcp_server.cache import get_or_build_cierre_report
from mcp_server.tools._errors import db_error, error

_MAX_N = 50


def get_top_anomalies(idempresa: int, periodo: str, n: int = 10) -> dict:
    n = max(1, min(int(n), _MAX_N))
    try:
        # Build with at least `n` top records; the engine default is 20.
        report = get_or_build_cierre_report(idempresa, periodo, top_n=max(n, 20))
    except Exception as exc:  # noqa: BLE001
        return db_error(exc)

    if not _has_data(report):
        return error(
            "no_data",
            f"No hay inventarios finalizados para empresa {idempresa} en {periodo}.",
        )

    anomalies = [asdict(a) for a in report.top_anomalies[:n]]
    return {
        "idempresa": idempresa,
        "periodo": periodo,
        "n": len(anomalies),
        "total_anomalies_found": report.total_anomalies_found,
        "anomalies": anomalies,
        "data_quality_warnings": report.data_quality_warnings,
    }


def _has_data(report: CierreReport) -> bool:
    return report.kpis.num_lineas > 0


__all__ = ["get_top_anomalies"]
