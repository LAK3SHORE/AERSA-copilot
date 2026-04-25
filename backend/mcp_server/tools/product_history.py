"""`get_product_history` MCP tool (CLAUDE.md §7.2 tool 3).

Returns the per-period merma_rate, financial impact, and z-score for a
specific (producto, almacen) pair over the last N months. The z-score
here is computed from the window's own mean/std — useful for spotting
which period's merma was out of line relative to the pair's own history.
"""
from __future__ import annotations

import pandas as pd

from db.queries.history import fetch_product_history
from mcp_server.tools._errors import db_error, error


def get_product_history(
    idproducto: int,
    idalmacen: int,
    last_n_periods: int = 12,
) -> dict:
    try:
        df = fetch_product_history(idproducto, idalmacen, last_n_periods)
    except Exception as exc:  # noqa: BLE001
        return db_error(exc)

    if df.empty:
        return error(
            "no_data",
            f"No hay historia para producto {idproducto} en almacén {idalmacen}.",
        )

    df = df.copy()
    teorico = df["teorico_units"].astype(float)
    loss = df["loss_units"].astype(float)
    df["merma_rate"] = (loss / teorico).where(teorico > 0)

    warnings: list[str] = []
    if len(df) < 3:
        warnings.append(
            f"solo {len(df)} periodos disponibles — z-score no es confiable"
        )

    mean = float(df["merma_rate"].mean()) if df["merma_rate"].notna().any() else 0.0
    std = float(df["merma_rate"].std(ddof=0)) if df["merma_rate"].notna().any() else 0.0
    if std > 0:
        df["z_score"] = (df["merma_rate"] - mean) / std
    else:
        df["z_score"] = pd.NA

    points = [
        {
            "periodo": str(row["periodo"]),
            "merma_rate": _f(row["merma_rate"]),
            "financial_impact_mxn": float(row["financial_impact_mxn"] or 0.0),
            "z_score": _f(row["z_score"]),
            "avg_costo": _f(row["avg_costo"]),
        }
        for _, row in df.iterrows()
    ]

    return {
        "idproducto": idproducto,
        "idalmacen": idalmacen,
        "n_periods": len(points),
        "mean_merma_rate": mean,
        "std_merma_rate": std,
        "points": points,
        "data_quality_warnings": warnings,
    }


def _f(x) -> float | None:
    if x is None or pd.isna(x):
        return None
    return float(x)


__all__ = ["get_product_history"]
