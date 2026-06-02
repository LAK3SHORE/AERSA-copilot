"""POST /api/query/nl2sql — corporativo NL→SQL chat (SSE, Session 15)."""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from api.json_util import dumps_sse
from api.models import Nl2SqlRequest
from auth.dependencies import require_corporativo
from auth.models import User
from llm.nl2sql import run_nl2sql

router = APIRouter(prefix="/api/query", tags=["query"])


async def _sse_stream(body: Nl2SqlRequest) -> AsyncIterator[dict[str, Any]]:
    history = [m.model_dump() for m in body.history]
    result = await run_nl2sql(
        body.message,
        history,
        idempresa=body.idempresa,
        periodo=body.periodo,
        tabla=body.tabla,
    )
    if "error" in result:
        yield {"data": dumps_sse({"type": "error", "message": result.get("message", result["error"])})}
        yield {"data": dumps_sse({"type": "done", "content": ""})}
        return

    explanation = result.get("explanation", "")
    row_count = int(result.get("row_count", 0))
    yield {
        "data": dumps_sse(
            {
                "type": "sql_result",
                "sql": result.get("sql", ""),
                "explanation": explanation,
                "columns": result.get("columns", []),
                "rows": result.get("rows", []),
                "row_count": row_count,
            }
        )
    }
    # Plain text only — UI renders sql_result (no HTML in chat markdown).
    summary = f"{explanation}\n\n**{row_count}** filas devueltas."
    yield {"data": dumps_sse({"type": "done", "content": summary})}


@router.post("/nl2sql")
async def nl2sql(
    request: Request,
    body: Nl2SqlRequest,
    _user: User = Depends(require_corporativo),
) -> EventSourceResponse:
    async def gen() -> AsyncIterator[dict[str, Any]]:
        if await request.is_disconnected():
            return
        async for frame in _sse_stream(body):
            if await request.is_disconnected():
                break
            yield frame

    return EventSourceResponse(gen())
