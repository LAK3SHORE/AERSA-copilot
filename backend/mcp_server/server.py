"""FastMCP server for the AERSA Copilot.

Registers the four v0 tools (CLAUDE.md 7) against a single `FastMCP`
instance. For v0 we import and call tools in-process from the FastAPI
agent (CLAUDE.md 7.1) — the stdio transport is available via `mcp.run()`
for external MCP clients (Claude Desktop, Inspector) when desired.

Run standalone over stdio:
    uv run python -m mcp_server.server
"""
from __future__ import annotations

import logging
import time
from typing import Any

from mcp.server.fastmcp import FastMCP

from mcp_server.tools.category_shrinkage import get_category_shrinkage as _cat_shrink
from mcp_server.tools.cierre_summary import get_cierre_summary as _cierre_summary
from mcp_server.tools.product_history import get_product_history as _product_history
from mcp_server.tools.top_anomalies import get_top_anomalies as _top_anomalies

log = logging.getLogger("mcp_server")

mcp = FastMCP("aersa-copilot")


def _log_call(name: str, args: dict, elapsed_ms: float, result: dict) -> None:
    """CLAUDE.md 15: log every tool call with timestamp, name, execution time."""
    status = "error" if isinstance(result, dict) and "error" in result else "ok"
    log.info("mcp.tool name=%s status=%s elapsed_ms=%.1f args=%s", name, status, elapsed_ms, args)


@mcp.tool()
def get_cierre_summary(idempresa: int, periodo: str) -> dict[str, Any]:
    """KPI summary de un Cierre de Semana para (idempresa, periodo='YYYY-MM').

    Úsalo cuando el auditor pida un panorama general: totales en MXN,
    número de almacenes y productos, porcentaje de líneas con merma, y
    categoría con mayor faltante. Devuelve también el conteo total de
    anomalías detectadas y cualquier advertencia de calidad de datos.
    """
    t0 = time.perf_counter()
    result = _cierre_summary(idempresa, periodo)
    _log_call("get_cierre_summary", {"idempresa": idempresa, "periodo": periodo},
              (time.perf_counter() - t0) * 1000, result)
    return result


@mcp.tool()
def get_top_anomalies(idempresa: int, periodo: str, n: int = 10) -> dict[str, Any]:
    """Top-N hallazgos anómalos de un Cierre (idempresa, periodo='YYYY-MM').

    Ranking por priority_score (severidad × impacto × recurrencia). Úsalo
    cuando el auditor pregunte qué revisar primero, qué es lo más grave,
    o quiera la lista priorizada. Devuelve producto, almacén, merma %,
    z-score, impacto financiero y etiqueta de severidad (CRÍTICO / ALTO /
    MEDIO / BAJO). n se limita a 50.
    """
    t0 = time.perf_counter()
    result = _top_anomalies(idempresa, periodo, n)
    _log_call("get_top_anomalies", {"idempresa": idempresa, "periodo": periodo, "n": n},
              (time.perf_counter() - t0) * 1000, result)
    return result


@mcp.tool()
def get_product_history(
    idproducto: int,
    idalmacen: int,
    last_n_periods: int = 12,
) -> dict[str, Any]:
    """Historia mensual de un producto en un almacén (últimos N periodos).

    Devuelve cada periodo con merma_rate, impacto financiero en MXN, y
    z-score contra la media/std de la ventana. Úsalo cuando el auditor
    pregunte si una anomalía es nueva o recurrente, o quiera la tendencia
    histórica de un producto específico. Requiere resolver el producto
    primero (no hay search_products en v0 — obtén el idproducto de
    get_top_anomalies).
    """
    t0 = time.perf_counter()
    result = _product_history(idproducto, idalmacen, last_n_periods)
    _log_call(
        "get_product_history",
        {"idproducto": idproducto, "idalmacen": idalmacen, "last_n_periods": last_n_periods},
        (time.perf_counter() - t0) * 1000,
        result,
    )
    return result


@mcp.tool()
def get_category_shrinkage(
    idempresa: int,
    periodo: str,
    idcategoria: int | None = None,
) -> dict[str, Any]:
    """Merma por categoría para (idempresa, periodo='YYYY-MM').

    Sin idcategoria: desglose por categoría de alto nivel (Alimentos,
    Bebidas, Gastos, etc.). Con idcategoria: drill-down a subcategorías
    de esa rama. Devuelve total_merma_mxn, pct_del_total y num_productos.
    Úsalo cuando el auditor quiera comparar Alimentos vs Bebidas o
    entender dónde se concentra el faltante.
    """
    t0 = time.perf_counter()
    result = _cat_shrink(idempresa, periodo, idcategoria)
    _log_call(
        "get_category_shrinkage",
        {"idempresa": idempresa, "periodo": periodo, "idcategoria": idcategoria},
        (time.perf_counter() - t0) * 1000,
        result,
    )
    return result


TOOL_REGISTRY: dict[str, Any] = {
    "get_cierre_summary": get_cierre_summary,
    "get_top_anomalies": get_top_anomalies,
    "get_product_history": get_product_history,
    "get_category_shrinkage": get_category_shrinkage,
}


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    # Stdio transport for Claude Desktop / MCP Inspector / external clients.
    mcp.run()
