"""NL → SQL for corporativo Datos Raw chat (Session 15).

Generates a single read-only SELECT via Ollama, validates it, executes against
MariaDB, and returns structured results for SSE streaming.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import ollama
from sqlalchemy import text

from config import settings
from db.connection import engine

log = logging.getLogger("llm.nl2sql")

_FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|"
    r"GRANT|REVOKE|REPLACE|MERGE|CALL)\b",
    re.IGNORECASE,
)

# Logical name → physical table/view for SHOW COLUMNS + hints
TABLA_PHYSICAL: dict[str, str] = {
    "cierre_detalle": "inventario_full",
    "inventario_fisico": "inventario_full",
    "requisiciones": "inventario_full",
    "ventas": "inventario_full",
}


def _fetch_schema(tabla: str) -> list[dict[str, str]]:
    physical = TABLA_PHYSICAL.get(tabla, tabla)
    with engine.connect() as conn:
        rows = conn.execute(text(f"SHOW COLUMNS FROM `{physical}`")).mappings().all()
    return [{"name": str(r["Field"]), "type": str(r["Type"])} for r in rows]


def _fetch_almacen_hints(idempresa: int, periodo: str) -> str:
    """Almacenes presentes en el cierre — inventario_full no trae nombres."""
    sql = text(
        """
        SELECT f.idalmacen, a.almacen_nombre
        FROM inventario_full f
        JOIN almacen a ON f.idalmacen = a.idalmacen
        WHERE f.idempresa = :idempresa AND f.periodo = :periodo
        GROUP BY f.idalmacen, a.almacen_nombre
        ORDER BY a.almacen_nombre
        LIMIT 40
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, {"idempresa": idempresa, "periodo": periodo}).mappings().all()
    except Exception:  # noqa: BLE001
        return "  (no disponible)"
    if not rows:
        return "  (sin filas para este cierre)"
    return "\n".join(f"  - idalmacen {r['idalmacen']}: {r['almacen_nombre']}" for r in rows)


def _build_system_prompt(
    tabla: str,
    idempresa: int,
    periodo: str,
    columns: list[dict[str, str]],
) -> str:
    col_lines = "\n".join(f"  - {c['name']}: {c['type']}" for c in columns)
    physical = TABLA_PHYSICAL.get(tabla, tabla)
    almacenes = _fetch_almacen_hints(idempresa, periodo)
    return f"""Eres un asistente SQL para TALOS (MariaDB, solo lectura).

Tabla lógica: {tabla}
Tabla física: {physical}  (alias recomendado: f)
Columnas en {physical}:
{col_lines}

Tablas relacionadas (JOIN cuando el usuario pida producto, categoría o almacén por nombre):
  - producto p ON f.idproducto = p.idproducto  → p.producto_nombre
  - almacen a ON f.idalmacen = a.idalmacen    → a.almacen_nombre
  - categoria c ON p.idcategoria = c.idcategoria → c.categoria_nombre

Almacenes en empresa {idempresa}, período {periodo}:
{almacenes}

Semántica TALOS (inventario):
  - diferencia = stock_fisico - stock_teorico (negativo = faltante / merma)
  - dif_importe = impacto en MXN del faltante/sobrante
  - Para «mayor merma» o «faltante»: filtra diferencia < 0 y ordena por
    SUM(ABS(f.dif_importe)) DESC o SUM(ABS(f.diferencia)) DESC.
  - NO uses SUM(diferencia) sin ABS ni sin filtrar: mezcla sobrantes y cancela filas.
  - Para almacén «Cocina» u otro nombre: JOIN almacen a y filtra
    a.almacen_nombre LIKE '%Cocina%' (no adivines idalmacen).

REGLAS OBLIGATORIAS:
1. Genera UN solo SELECT (sin punto y coma final).
2. La consulta DEBE incluir: WHERE f.idempresa = {idempresa} AND f.periodo = '{periodo}'
   (usa alias f para inventario_full).
3. Nunca INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE ni DDL.
4. Responde SOLO con JSON válido (sin markdown): {{"sql": "...", "explanation": "..."}}
5. explanation: una oración en español describiendo la consulta.
6. Los alias del SELECT y del ORDER BY deben coincidir exactamente (misma ortografía).
7. Para «mayor merma» ordena por el impacto en MXN DESC: ORDER BY SUM(ABS(f.dif_importe)) DESC.
"""


def _cell_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _select_aliases(sql: str) -> list[str]:
    m = re.search(r"\bSELECT\s+(.*?)\s+FROM\b", sql, re.IGNORECASE | re.DOTALL)
    if not m:
        return []
    return re.findall(r"\bAS\s+(\w+)\b", m.group(1), re.IGNORECASE)


def _closest_alias(name: str, aliases: list[str]) -> str | None:
    low = name.lower()
    by_lower = {a.lower(): a for a in aliases}
    if low in by_lower:
        return by_lower[low]
    for a in aliases:
        al = a.lower()
        if low in al or al in low:
            return a
    if not aliases:
        return None
    return min(aliases, key=lambda a: _edit_distance(low, a.lower()))


def _edit_distance(a: str, b: str) -> int:
    if len(a) < len(b):
        return _edit_distance(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            curr.append(min(curr[-1] + 1, prev[j] + 1, prev[j - 1] + cost))
        prev = curr
    return prev[-1]


def repair_sql_aliases(sql: str) -> str:
    """Fix ORDER BY references that typo SELECT aliases (common LLM mistake)."""
    aliases = _select_aliases(sql)
    if not aliases:
        return sql
    alias_lower = {a.lower() for a in aliases}

    m = re.search(
        r"\bORDER\s+BY\s+(.+?)(?=\s+LIMIT\b|\s+OFFSET\b|$)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return sql

    parts = re.split(r"\s*,\s*", m.group(1).strip())
    fixed: list[str] = []
    for part in parts:
        tokens = part.strip().split()
        if not tokens:
            continue
        col = tokens[0]
        rest = tokens[1:]
        if col.lower() not in alias_lower:
            match = _closest_alias(col, aliases)
            if match and _edit_distance(col.lower(), match.lower()) <= 4:
                col = match
        fixed.append(" ".join([col, *rest]))

    order_clause = ", ".join(fixed)
    return sql[: m.start(1)] + order_clause + sql[m.end(1) :]


def validate_sql(sql: str) -> str | None:
    """Return error message if invalid; None if OK."""
    s = sql.strip().rstrip(";").strip()
    if not s.upper().startswith("SELECT"):
        return "Solo se permiten consultas SELECT"
    if _FORBIDDEN.search(s):
        return "La consulta contiene operaciones no permitidas"
    if ";" in s:
        return "No se permiten múltiples sentencias"
    return None


def _parse_model_json(content: str) -> dict[str, str]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    data = json.loads(content)
    if not isinstance(data, dict) or "sql" not in data:
        raise ValueError("JSON debe incluir clave 'sql'")
    return {"sql": str(data["sql"]), "explanation": str(data.get("explanation", ""))}


async def run_nl2sql(
    message: str,
    history: list[dict[str, str]],
    *,
    idempresa: int,
    periodo: str,
    tabla: str = "cierre_detalle",
) -> dict[str, Any]:
    """Generate SQL, validate, execute; return sql + explanation + tabular data."""
    columns = _fetch_schema(tabla)
    system = _build_system_prompt(tabla, idempresa, periodo, columns)

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for h in history[-8:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    client = ollama.AsyncClient(host=settings.ollama_host)
    resp = await client.chat(
        model=settings.ollama_model,
        messages=messages,
        format="json",
        options={"temperature": 0.1},
    )
    raw_content = resp.message.content or "{}"
    try:
        parsed = _parse_model_json(raw_content)
    except (json.JSONDecodeError, ValueError) as exc:
        return {
            "error": "parse_error",
            "message": f"No pude interpretar la respuesta del modelo: {exc}",
        }

    sql = repair_sql_aliases(parsed["sql"].strip())
    err = validate_sql(sql)
    if err:
        return {"error": "validation_error", "message": err, "sql": sql}

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            cols = list(result.keys())
            rows = [[_cell_json(c) for c in r] for r in result.fetchmany(500)]
    except Exception as exc:  # noqa: BLE001
        log.warning("nl2sql execute failed: %s", exc)
        return {
            "error": "execute_error",
            "message": str(exc),
            "sql": sql,
            "explanation": parsed.get("explanation", ""),
        }

    return {
        "sql": sql,
        "explanation": parsed.get("explanation", ""),
        "columns": cols,
        "rows": rows,
        "row_count": len(rows),
    }


__all__ = ["run_nl2sql", "validate_sql", "repair_sql_aliases", "TABLA_PHYSICAL"]
