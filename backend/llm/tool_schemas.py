"""Convert FastMCP tool descriptors → Ollama function-calling schemas.

CLAUDE.md §8.3 says to derive these programmatically from the MCP server
so the LLM and the MCP layer can never drift. FastMCP already produces
JSON Schema for each tool's input; we wrap it in OpenAI-style envelopes
that Ollama accepts.
"""
from __future__ import annotations

from typing import Any

from mcp_server.server import mcp

_CACHE: list[dict[str, Any]] | None = None


def _clean_description(desc: str | None) -> str:
    if not desc:
        return ""
    # Collapse the indented continuation lines that come from Python docstrings
    # (FastMCP keeps them as-is). Gemma reads tool descriptions inline so we
    # want a tight single-paragraph description without leading whitespace.
    lines = [line.strip() for line in desc.splitlines() if line.strip()]
    return " ".join(lines)


def _to_ollama(tool) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": _clean_description(tool.description),
            "parameters": tool.inputSchema,
        },
    }


async def get_ollama_tool_schemas() -> list[dict[str, Any]]:
    """Return all registered MCP tools formatted for Ollama's `tools=` arg.

    Cached after the first call — the registry is static across the process.
    """
    global _CACHE
    if _CACHE is None:
        tools = await mcp.list_tools()
        _CACHE = [_to_ollama(t) for t in tools]
    return _CACHE


__all__ = ["get_ollama_tool_schemas"]
