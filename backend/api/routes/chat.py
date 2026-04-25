"""POST /api/chat — SSE-streaming tool-calling agent (CLAUDE.md §9.4).

Wraps `llm.agent.run_agent` (the async generator that drives Gemma's
tool-calling loop) with `sse_starlette.EventSourceResponse`. Each event
the agent yields is forwarded as one SSE frame whose `data:` payload is a
JSON-encoded copy of the original dict — the frontend just `JSON.parse`s.

Pre-warms `num_almacenes` from the cached CierreReport (when present) so
the system prompt's "Almacenes activos" field is accurate without paying
to rebuild the report on every chat turn.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from api.models import ChatRequest
from llm.agent import run_agent
from mcp_server.cache import get_or_build_cierre_report

log = logging.getLogger("api.chat")

router = APIRouter(prefix="/api", tags=["chat"])


def _peek_num_almacenes(idempresa: int, periodo: str) -> int | None:
    """Read num_almacenes from the cached report. Never block on a fresh build —
    the agent will get the value via tool calls if the cache is cold."""
    try:
        report = get_or_build_cierre_report(idempresa, periodo)
    except Exception:  # noqa: BLE001 — purely a context hint; ignore failures
        return None
    return report.kpis.num_almacenes if report.kpis.num_lineas > 0 else None


async def _sse_stream(
    request: Request,
    body: ChatRequest,
) -> AsyncIterator[dict[str, Any]]:
    history = [m.model_dump() for m in body.history]
    num_almacenes = _peek_num_almacenes(body.idempresa, body.periodo)

    log.info(
        "chat.start empresa=%s periodo=%s msg_chars=%d history_len=%d",
        body.idempresa,
        body.periodo,
        len(body.message),
        len(history),
    )

    try:
        async for evt in run_agent(
            idempresa=body.idempresa,
            periodo=body.periodo,
            user_message=body.message,
            history=history,
            num_almacenes=num_almacenes,
        ):
            if await request.is_disconnected():
                log.info("chat.client_disconnected empresa=%s periodo=%s", body.idempresa, body.periodo)
                return
            yield {"data": json.dumps(evt, ensure_ascii=False, default=str)}
    except Exception as exc:  # noqa: BLE001
        log.exception("chat.agent_failed")
        yield {
            "data": json.dumps(
                {"type": "error", "message": f"agent_error: {exc}"},
                ensure_ascii=False,
            )
        }


@router.post("/chat")
async def chat(body: ChatRequest, request: Request) -> EventSourceResponse:
    return EventSourceResponse(_sse_stream(request, body))
