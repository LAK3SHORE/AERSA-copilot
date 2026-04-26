"""SQL queries for the historical baseline used in anomaly detection.

For each (idproducto, idalmacen, periodo) over the lookback window we
aggregate diferencia and stock_teorico so the engine can derive a per-period
merma_rate observation. The engine then computes mean / std / quartiles in
pandas (CLAUDE.md 6.2).
"""
from __future__ import annotations

from datetime import date

import pandas as pd
from sqlalchemy import text

from db.connection import engine


# ─── Historical baseline rows ─────────────────────────────────────────
# One row per (idproducto, idalmacen, periodo). The current periodo is
# excluded — only past observations contribute to the baseline.
_BASELINE_SQL = text("""
SELECT
    f.idproducto,
    f.idalmacen,
    f.periodo,
    SUM(-f.diferencia)    AS loss_units,
    SUM(f.stock_teorico)  AS teorico_units,
    AVG(f.costo_promedio) AS avg_costo
FROM inventario_full f
WHERE f.idempresa = :idempresa
  AND f.periodo  >= :start_periodo
  AND f.periodo  <  :end_periodo
  AND f.stock_teorico > 0
GROUP BY f.idproducto, f.idalmacen, f.periodo
""")


def _shift_periodo(periodo: str, months: int) -> str:
    """Shift a 'YYYY-MM' string by an integer number of months (signed)."""
    y, m = (int(x) for x in periodo.split("-"))
    total = y * 12 + (m - 1) + months
    ny, nm = divmod(total, 12)
    return f"{ny:04d}-{nm + 1:02d}"


def fetch_historical_baseline(
    idempresa: int,
    current_periodo: str,
    lookback_months: int,
) -> pd.DataFrame:
    """Pull pre-aggregated per-period observations for the baseline window.

    The window is `[current - lookback_months, current)` exclusive of the
    current period itself, so the baseline is independent of the period
    being audited.
    """
    start_periodo = _shift_periodo(current_periodo, -lookback_months)
    end_periodo = current_periodo  # exclusive
    return pd.read_sql(
        _BASELINE_SQL,
        engine,
        params={
            "idempresa": idempresa,
            "start_periodo": start_periodo,
            "end_periodo": end_periodo,
        },
    )


__all__ = ["fetch_historical_baseline", "_shift_periodo"]
