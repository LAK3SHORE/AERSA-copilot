"""Spanish display names for MCP tools (user-facing copy)."""
from __future__ import annotations

from typing import Any

MCP_TOOL_LABELS: dict[str, str] = {
    "get_top_anomalies": "Hallazgos más críticos",
    "get_cierre_summary": "Resumen del cierre",
    "get_category_shrinkage": "Merma por categoría",
    "get_product_history": "Historial del producto",
    "generate_audit_brief": "Brief de auditoría",
}


def tool_label(tool_name: str) -> str:
    return MCP_TOOL_LABELS.get(tool_name, tool_name.replace("_", " ").title())


def enrich_analytics_for_prompt(analytics: dict[str, Any]) -> dict[str, Any]:
    """Add nombre_visible to tool rows; strip reliance on snake_case in LLM answers."""
    out = dict(analytics)
    tools = dict(out.get("tools") or {})
    ranking = []
    for row in tools.get("ranking") or []:
        r = dict(row)
        r["nombre_visible"] = tool_label(str(r.get("tool_name", "")))
        ranking.append(r)
    tools["ranking"] = ranking
    if tools.get("most_used"):
        mu = dict(tools["most_used"])
        mu["nombre_visible"] = tool_label(str(mu.get("tool_name", "")))
        tools["most_used"] = mu
    if tools.get("least_used"):
        lu = dict(tools["least_used"])
        lu["nombre_visible"] = tool_label(str(lu.get("tool_name", "")))
        tools["least_used"] = lu
    out["tools"] = tools
    out["herramientas_glossary"] = [
        {"id_tecnico": k, "nombre_visible": v} for k, v in MCP_TOOL_LABELS.items()
    ]
    return out


def glossary_markdown() -> str:
    lines = [f"- **{v}** (no escribas `{k}`)" for k, v in MCP_TOOL_LABELS.items()]
    return "\n".join(lines)


__all__ = [
    "MCP_TOOL_LABELS",
    "tool_label",
    "enrich_analytics_for_prompt",
    "glossary_markdown",
]
