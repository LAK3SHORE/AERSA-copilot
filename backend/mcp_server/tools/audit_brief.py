"""`generate_audit_brief` MCP tool (Session 11)."""
from __future__ import annotations

from engine.brief import build_audit_brief
from mcp_server.cache import get_or_build_cierre_report
from mcp_server.tools._errors import db_error, error


def generate_audit_brief(idempresa: int, periodo: str) -> dict:
    try:
        report = get_or_build_cierre_report(idempresa, periodo)
    except Exception as exc:  # noqa: BLE001
        return db_error(exc)

    if report.kpis.num_lineas == 0:
        return error(
            "no_data",
            f"No hay inventarios finalizados para empresa {idempresa} en {periodo}.",
        )

    return build_audit_brief(report)


__all__ = ["generate_audit_brief"]
