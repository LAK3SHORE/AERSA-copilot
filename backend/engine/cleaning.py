"""In-pandas cleaning helpers.

Most filtering is enforced at the DB level via `inventariomesdetalle_clean`
and `inventario_full` (see `db/views.sql`). These helpers cover the residual
edge cases that only show up after joins, plus a couple of validation
utilities for tests.
"""
from __future__ import annotations

import pandas as pd

from config import settings


def filter_lines(df: pd.DataFrame) -> pd.DataFrame:
    """Defensive guards on a Cierre line-level DataFrame.

    The view already filters the corrupt row and outlier thresholds, but
    after joins a few lines can have NaN costo_promedio (when the master
    cost lookup fails) or zero stock_teorico (legitimate but unusable for
    merma_rate). We don't drop those — we keep them and the engine
    decides downstream whether to treat them as anomalies or as
    "insufficient signal".
    """
    if df.empty:
        return df

    # Hard guard: re-apply outlier thresholds in case a future join leaks rows.
    df = df[df["stock_fisico"].fillna(0) < settings.outlier_max_stock_fisico]
    df = df[df["importe_fisico"].fillna(0) < settings.outlier_max_importe_fisico]

    return df.reset_index(drop=True)


def attach_merma_rate(df: pd.DataFrame, value_col: str = "merma_rate") -> pd.DataFrame:
    """Add a merma_rate column to a line- or aggregate-level DataFrame.

    merma_rate = -diferencia / stock_teorico (positive = shortage). Rows
    with stock_teorico <= 0 get NaN — the engine treats those as
    "no signal" and excludes them from baseline statistics.
    """
    diferencia = df["diferencia"] if "diferencia" in df.columns else -df["loss_units"]
    teorico = df["stock_teorico"] if "stock_teorico" in df.columns else df["teorico_units"]

    rate = pd.Series(pd.NA, index=df.index, dtype="Float64")
    valid = teorico > 0
    rate.loc[valid] = (-diferencia.loc[valid].astype(float) / teorico.loc[valid].astype(float))
    return df.assign(**{value_col: rate})
