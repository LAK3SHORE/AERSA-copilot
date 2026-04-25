"""`get_category_shrinkage` MCP tool (CLAUDE.md §7.2 tool 4).

Breaks down faltantes (negative diferencia × costo) by top-level
categoria, or by subcategoria when drilling into a specific idcategoria.
"""
from __future__ import annotations

from db.queries.cierre import fetch_category_shrinkage
from mcp_server.tools._errors import db_error, error


def get_category_shrinkage(
    idempresa: int,
    periodo: str,
    idcategoria: int | None = None,
) -> dict:
    try:
        df = fetch_category_shrinkage(idempresa, periodo, idcategoria)
    except Exception as exc:  # noqa: BLE001
        return db_error(exc)

    if df.empty:
        return error(
            "no_data",
            (
                f"Sin faltantes para empresa {idempresa} en {periodo}"
                + (f", categoría {idcategoria}." if idcategoria else ".")
            ),
        )

    total = float(df["total_merma_mxn"].sum() or 0.0)
    rows = []
    for _, r in df.iterrows():
        merma = float(r["total_merma_mxn"] or 0.0)
        row = {
            "categoria": str(r["categoria"]),
            "subcategoria": str(r["subcategoria"]),
            "total_merma_mxn": merma,
            "pct_del_total": (merma / total) if total > 0 else 0.0,
            "num_productos": int(r["num_productos"] or 0),
        }
        if idcategoria is None and "idcategoria" in r:
            row["idcategoria"] = int(r["idcategoria"]) if r["idcategoria"] else None
        if idcategoria is not None and "idsubcategoria" in r:
            row["idsubcategoria"] = int(r["idsubcategoria"]) if r["idsubcategoria"] else None
        rows.append(row)

    return {
        "idempresa": idempresa,
        "periodo": periodo,
        "idcategoria": idcategoria,
        "total_merma_mxn": total,
        "breakdown": rows,
    }


__all__ = ["get_category_shrinkage"]
