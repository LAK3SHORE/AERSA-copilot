"""Historical trend queries for a single (producto, almacen) pair.

Feeds the MCP `get_product_history` tool (CLAUDE.md §7.2 tool 3). The
engine's baseline module pulls company-wide history; this one is scoped
to a single product × warehouse over the last N periods.
"""
from __future__ import annotations

import pandas as pd
from sqlalchemy import text

from db.connection import engine

# One row per periodo for this (producto, almacen).
# loss_units and teorico_units let us derive merma_rate = loss/teorico in pandas.
# financial_impact is |diferencia| * costo_promedio summed over the month's lines.
_PRODUCT_HISTORY_SQL = text("""
SELECT
    f.periodo,
    SUM(-f.diferencia)                                  AS loss_units,
    SUM(f.stock_teorico)                                AS teorico_units,
    SUM(ABS(f.diferencia) * f.costo_promedio)           AS financial_impact_mxn,
    AVG(f.costo_promedio)                               AS avg_costo
FROM inventario_full f
WHERE f.idproducto = :idproducto
  AND f.idalmacen  = :idalmacen
GROUP BY f.periodo
ORDER BY f.periodo ASC
""")


def fetch_product_history(
    idproducto: int,
    idalmacen: int,
    last_n_periods: int = 12,
) -> pd.DataFrame:
    """Return the last `last_n_periods` monthly observations (chronological)."""
    df = pd.read_sql(
        _PRODUCT_HISTORY_SQL,
        engine,
        params={"idproducto": idproducto, "idalmacen": idalmacen},
    )
    if df.empty:
        return df
    if last_n_periods and len(df) > last_n_periods:
        df = df.tail(last_n_periods).reset_index(drop=True)
    return df


__all__ = ["fetch_product_history"]
