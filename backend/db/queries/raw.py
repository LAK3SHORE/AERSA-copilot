"""Raw Cierre rows for corporativo Datos Raw tab (Session 15).

Reads from `inventario_full` and enriches with engine metrics (merma %, z-score)
via the same annotate/score pipeline used for hallazgos.
"""
from __future__ import annotations

import pandas as pd

from db.queries.cierre import fetch_lines
from engine.anomaly import annotate_lines, compute_baseline
from engine.cleaning import filter_lines
from engine.scoring import compute_priority_scores, compute_score_ponderado

ALLOWED_TABLAS = frozenset({"cierre_detalle"})


def fetch_raw_cierre_rows(
    idempresa: int,
    periodo: str,
    *,
    limit: int = 2000,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Return paginated raw rows + total count after engine enrichment."""
    raw_lines = fetch_lines(idempresa, periodo)
    if raw_lines.empty:
        return [], 0

    lines = filter_lines(raw_lines)
    baseline_stats, baseline_obs = compute_baseline(idempresa, periodo)
    annotated = annotate_lines(lines, baseline_stats, baseline_obs)
    scored = compute_score_ponderado(compute_priority_scores(annotated))
    total = len(scored)

    page = scored.iloc[offset : offset + limit]
    rows: list[dict] = []
    for _, r in page.iterrows():
        sf = float(r.get("stock_fisico") or 0.0)
        st = float(r.get("stock_teorico") or 0.0)
        diff = float(r.get("diferencia") or 0.0)
        merma = r.get("merma_rate")
        mp = float(merma * 100.0) if merma is not None and pd.notna(merma) else 0.0
        z = r.get("z_score")
        rows.append(
            {
                "idalmacen": int(r["idalmacen"]),
                "almacen": str(r["almacen_nombre"]),
                "idprod": int(r["idproducto"]),
                "producto": str(r["producto_nombre"]),
                "cat": str(r["categoria_nombre"]),
                "sf": sf,
                "st": st,
                "d": diff,
                "mp": round(mp, 1),
                "mxn": abs(float(r.get("financial_impact_mxn") or 0.0)),
                "z": round(float(z), 2) if z is not None and pd.notna(z) else 0.0,
            }
        )
    return rows, total


__all__ = ["ALLOWED_TABLAS", "fetch_raw_cierre_rows"]
