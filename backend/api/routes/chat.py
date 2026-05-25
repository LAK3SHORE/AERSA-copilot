"""POST /api/chat — SSE-streaming tool-calling agent (CLAUDE.md 9.4).

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

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from analytics.logging import log_event
from analytics.metrics import dashboard_bundle
from api.models import ChatRequest, CorporativoChatRequest
from auth.dependencies import assert_empresa_access, get_current_user, require_corporativo
from auth.models import User
from llm.agent import run_agent, run_corporativo_agent
from llm.finding_prompt import FindingContext, build_finding_user_message
from mcp_server.cache import _CACHE as _CIERRE_CACHE

log = logging.getLogger("api.chat")

router = APIRouter(prefix="/api", tags=["chat"])


def _peek_num_almacenes(idempresa: int, periodo: str) -> int | None:
    """Peek num_almacenes from the cache *only* — never trigger a build.

    A cold cache means the FE hasn't loaded the cierre yet (or the TTL
    expired). The agent will get accurate counts via its tool calls;
    we just leave the system-prompt's "Almacenes activos" as "—" rather
    than blocking the chat turn for ~5s on a fresh report build.
    """
    for top_n in (20, 10, 50):
        report = _CIERRE_CACHE.get((idempresa, periodo, top_n))
        if report is not None and report.kpis.num_lineas > 0:
            return report.kpis.num_almacenes
    return None


async def _sse_stream(
    request: Request,
    body: ChatRequest,
    user: User,
) -> AsyncIterator[dict[str, Any]]:
    history = [m.model_dump() for m in body.history]
    num_almacenes = _peek_num_almacenes(body.idempresa, body.periodo)

    agent_message = body.message
    if body.finding_context is not None:
        fc = body.finding_context
        agent_message = build_finding_user_message(
            idempresa=body.idempresa,
            periodo=body.periodo,
            finding=FindingContext(
                idinventariomesdetalle=fc.idinventariomesdetalle,
                idproducto=fc.idproducto,
                idalmacen=fc.idalmacen,
                producto_nombre=fc.producto_nombre,
                almacen_nombre=fc.almacen_nombre,
                severity_label=fc.severity_label,
            ),
            natural_question=body.message,
        )

    if body.session_id is not None:
        log_event(
            body.session_id,
            user.id,
            "chat_message",
            {
                "length": len(body.message),
                "suggested": body.suggested,
                "has_finding_context": body.finding_context is not None,
                "idinventariomesdetalle": (
                    body.finding_context.idinventariomesdetalle
                    if body.finding_context
                    else None
                ),
            },
        )

    log.info(
        "chat.start empresa=%s periodo=%s msg_chars=%d agent_chars=%d history_len=%d session=%s finding=%s",
        body.idempresa,
        body.periodo,
        len(body.message),
        len(agent_message),
        len(history),
        body.session_id,
        body.finding_context is not None,
    )

    try:
        async for evt in run_agent(
            idempresa=body.idempresa,
            periodo=body.periodo,
            user_message=agent_message,
            history=history,
            num_almacenes=num_almacenes,
            user_id=user.id,
            session_id=body.session_id,
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


async def _sse_corporativo_stream(
    request: Request,
    body: CorporativoChatRequest,
    user: User,
) -> AsyncIterator[dict[str, Any]]:
    history = [m.model_dump() for m in body.history]
    analytics = dashboard_bundle(body.days)
    log.info(
        "chat.corporativo user=%s days=%d msg_chars=%d history_len=%d",
        user.username,
        body.days,
        len(body.message),
        len(history),
    )
    try:
        async for evt in run_corporativo_agent(
            user_message=body.message,
            analytics=analytics,
            history=history,
            days=body.days,
        ):
            if await request.is_disconnected():
                return
            yield {"data": json.dumps(evt, ensure_ascii=False, default=str)}
    except Exception as exc:  # noqa: BLE001
        log.exception("chat.corporativo_failed")
        yield {
            "data": json.dumps(
                {"type": "error", "message": f"agent_error: {exc}"},
                ensure_ascii=False,
            )
        }


@router.post("/chat")
async def chat(
    body: ChatRequest,
    request: Request,
    user: User = Depends(get_current_user),
) -> EventSourceResponse:
    assert_empresa_access(user, body.idempresa)
    request.state.user_id = user.id
    request.state.username = user.username
    return EventSourceResponse(_sse_stream(request, body, user))


@router.post("/chat/corporativo")
async def chat_corporativo(
    body: CorporativoChatRequest,
    request: Request,
    user: User = Depends(require_corporativo),
) -> EventSourceResponse:
    request.state.user_id = user.id
    request.state.username = user.username
    return EventSourceResponse(_sse_corporativo_stream(request, body, user))
