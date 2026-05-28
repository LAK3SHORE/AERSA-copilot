"""NL → SQL for corporativo Datos Raw chat (Session 15).

Generates a single read-only SELECT via Ollama, validates it, executes against
MariaDB, and returns structured results for SSE streaming.
"""
from __future__ import annotations

import json
import logging
import re
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


def _build_system_prompt(
    tabla: str,
    idempresa: int,
    periodo: str,
    columns: list[dict[str, str]],
) -> str:
    col_lines = "\n".join(f"  - {c['name']}: {c['type']}" for c in columns)
    physical = TABLA_PHYSICAL.get(tabla, tabla)
    return f"""Eres un asistente SQL para TALOS (MariaDB, solo lectura).

Tabla lógica: {tabla}
Tabla física: {physical}
Columnas:
{col_lines}

REGLAS OBLIGATORIAS:
1. Genera UN solo SELECT (sin punto y coma final).
2. La consulta DEBE incluir: WHERE idempresa = {idempresa} AND periodo = '{periodo}'
3. Nunca INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE ni DDL.
4. Responde SOLO con JSON válido (sin markdown): {{"sql": "...", "explanation": "..."}}
5. explanation: una oración en español describiendo la consulta.
"""


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

    sql = parsed["sql"].strip()
    err = validate_sql(sql)
    if err:
        return {"error": "validation_error", "message": err, "sql": sql}

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            cols = list(result.keys())
            rows = [list(r) for r in result.fetchmany(500)]
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


__all__ = ["run_nl2sql", "validate_sql", "TABLA_PHYSICAL"]
