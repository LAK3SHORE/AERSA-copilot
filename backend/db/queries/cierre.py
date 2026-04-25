"""SQL queries for Cierre de Semana data: KPI summary and line-level pulls.

All queries read from the `inventario_full` view (CLAUDE.md §6.1), which is
already filtered for outliers and finalized inventories. Joins enrich with
producto, categoria, almacen, and unidadmedida for display.
"""
from __future__ import annotations

import pandas as pd
from sqlalchemy import text

from db.connection import engine

# ─── KPI summary ──────────────────────────────────────────────────────
# Aggregate metrics for the full Cierre, used by KPISummary.
_KPI_SQL = text("""
SELECT
    COUNT(DISTINCT f.idalmacen)                                    AS num_almacenes,
    COUNT(DISTINCT f.idproducto)                                   AS num_productos,
    COUNT(*)                                                       AS num_lineas,
    SUM(f.importe_fisico)                                          AS total_importe_fisico_mxn,
    SUM(CASE WHEN f.diferencia < 0 THEN ABS(f.dif_importe) ELSE 0 END) AS total_faltantes_mxn,
    SUM(CASE WHEN f.diferencia > 0 THEN f.dif_importe       ELSE 0 END) AS total_sobrantes_mxn,
    SUM(f.ingreso_compra)                                          AS total_compras_unidades,
    SUM(f.egreso_venta)                                            AS total_ventas_unidades,
    SUM(CASE WHEN f.diferencia < 0 THEN 1 ELSE 0 END) / COUNT(*)   AS pct_lineas_con_merma
FROM inventario_full f
WHERE f.idempresa = :idempresa
  AND f.periodo   = :periodo
""")


# ─── Top problem category (by faltante MXN) ───────────────────────────
# Returns the (categoria > subcategoria) pair concentrating the most shortage
# in MXN, used for KPISummary.top_categoria_faltante.
_TOP_CAT_SQL = text("""
SELECT
    COALESCE(c1.categoria_nombre, 'Sin categoría')   AS categoria,
    COALESCE(c2.categoria_nombre, '—')               AS subcategoria,
    SUM(ABS(f.dif_importe))                          AS faltante_mxn
FROM inventario_full f
JOIN producto p           ON f.idproducto      = p.idproducto
LEFT JOIN categoria c1    ON p.idcategoria     = c1.idcategoria
LEFT JOIN categoria c2    ON p.idsubcategoria  = c2.idcategoria
WHERE f.idempresa = :idempresa
  AND f.periodo   = :periodo
  AND f.diferencia < 0
GROUP BY c1.categoria_nombre, c2.categoria_nombre
ORDER BY faltante_mxn DESC
LIMIT 1
""")


# ─── Line-level Cierre data with enrichment ───────────────────────────
# One row per inventariomesdetalle entry in the period, enriched with
# producto / categoria / subcategoria / almacen / unidadmedida.
_LINES_SQL = text("""
SELECT
    f.idinventariomesdetalle,
    f.idproducto,
    f.idalmacen,
    f.idsucursal,
    f.periodo,
    f.stock_inicial,
    f.stock_teorico,
    f.stock_fisico,
    f.diferencia,
    f.ingreso_compra,
    f.egreso_venta,
    f.ingreso_req,
    f.egreso_req,
    f.reajuste,
    f.costo_promedio,
    f.importe_fisico,
    f.dif_importe,
    p.producto_nombre,
    p.idcategoria,
    p.idsubcategoria,
    p.producto_tipo,
    COALESCE(c1.categoria_nombre, 'Sin categoría')      AS categoria_nombre,
    COALESCE(c2.categoria_nombre, '—')                  AS subcategoria_nombre,
    a.almacen_nombre,
    COALESCE(u.unidadmedida_es_MX, '—')                 AS unidad_medida
FROM inventario_full f
JOIN producto p           ON f.idproducto      = p.idproducto
LEFT JOIN categoria c1    ON p.idcategoria     = c1.idcategoria
LEFT JOIN categoria c2    ON p.idsubcategoria  = c2.idcategoria
JOIN almacen a            ON f.idalmacen       = a.idalmacen
LEFT JOIN unidadmedida u  ON p.idunidadmedida  = u.idunidadmedida
WHERE f.idempresa = :idempresa
  AND f.periodo   = :periodo
""")


def fetch_kpi_row(idempresa: int, periodo: str) -> dict:
    with engine.connect() as conn:
        row = conn.execute(_KPI_SQL, {"idempresa": idempresa, "periodo": periodo}).mappings().first()
        return dict(row) if row else {}


def fetch_top_categoria_faltante(idempresa: int, periodo: str) -> dict:
    with engine.connect() as conn:
        row = conn.execute(_TOP_CAT_SQL, {"idempresa": idempresa, "periodo": periodo}).mappings().first()
        return dict(row) if row else {}


def fetch_lines(idempresa: int, periodo: str) -> pd.DataFrame:
    return pd.read_sql(_LINES_SQL, engine, params={"idempresa": idempresa, "periodo": periodo})
