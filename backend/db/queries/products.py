"""Product / category / period lookup queries.

Lightweight helpers used by `/api/companies`, `/api/periods/{empresa}`, and
the MCP `search_products` tool (deferred per CLAUDE.md §13.2 but the SQL is
trivial so we ship it now).
"""
from __future__ import annotations

import pandas as pd
from sqlalchemy import text

from db.connection import engine


# ─── Available companies (top by inventory volume) ────────────────────
_COMPANIES_SQL = text("""
SELECT m.idempresa, COUNT(*) AS num_inventarios
FROM inventariomes m
WHERE m.inventariomes_estatus IN ('finalizado', 'aplicado', 'terminado')
GROUP BY m.idempresa
ORDER BY num_inventarios DESC
LIMIT :limit
""")


# ─── Available periods for an empresa (descending) ────────────────────
_PERIODS_SQL = text("""
SELECT DISTINCT periodo
FROM inventario_full
WHERE idempresa = :idempresa
ORDER BY periodo DESC
""")


# ─── Product search by partial name ───────────────────────────────────
_SEARCH_PRODUCTS_SQL = text("""
SELECT
    p.idproducto,
    p.producto_nombre AS nombre,
    p.producto_tipo   AS tipo,
    COALESCE(c1.categoria_nombre, 'Sin categoría') AS categoria,
    COALESCE(c2.categoria_nombre, '—')             AS subcategoria,
    COALESCE(u.unidadmedida_es_MX, '—')            AS unidad_medida
FROM producto p
LEFT JOIN categoria c1   ON p.idcategoria    = c1.idcategoria
LEFT JOIN categoria c2   ON p.idsubcategoria = c2.idcategoria
LEFT JOIN unidadmedida u ON p.idunidadmedida = u.idunidadmedida
WHERE p.idempresa = :idempresa
  AND p.producto_baja = 0
  AND p.producto_nombre LIKE :pattern
ORDER BY p.producto_nombre
LIMIT :limit
""")


def fetch_companies(limit: int = 10) -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(_COMPANIES_SQL, {"limit": limit}).mappings().all()
        return [dict(r) for r in rows]


def fetch_periods(idempresa: int) -> list[str]:
    with engine.connect() as conn:
        rows = conn.execute(_PERIODS_SQL, {"idempresa": idempresa}).all()
        return [r[0] for r in rows]


def search_products(idempresa: int, query: str, limit: int = 10) -> pd.DataFrame:
    pattern = f"%{query.strip()}%"
    return pd.read_sql(
        _SEARCH_PRODUCTS_SQL,
        engine,
        params={"idempresa": idempresa, "pattern": pattern, "limit": limit},
    )
