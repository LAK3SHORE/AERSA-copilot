"""Error envelope shared by all MCP tools (CLAUDE.md §7.3)."""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def error(code: str, message: str) -> dict:
    return {"error": code, "message": message}


def db_error(exc: Exception) -> dict:
    log.exception("MCP tool DB failure: %s", exc)
    return error("db_error", f"Error consultando la base de datos: {exc}")


__all__ = ["error", "db_error"]
