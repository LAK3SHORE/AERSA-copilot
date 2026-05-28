"""POST /api/query/nl2sql — corporativo NL→SQL chat (SSE, Session 15)."""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

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
        yield {"data": json.dumps({"type": "error", "message": result.get("message", result["error"])})}
        yield {"data": json.dumps({"type": "done", "content": ""})}
        return

    explanation = result.get("explanation", "")
    sql = result.get("sql", "")
    content = (
        f"<p>{explanation}</p>"
        f'<pre style="background:rgba(132,172,55,0.05);padding:10px;font-size:10px;'
        f'overflow-x:auto;margin:8px 0"><code>{sql}</code></pre>'
        f"<p><strong>{result.get('row_count', 0)} filas devueltas</strong></p>"
    )
    yield {
        "data": json.dumps(
            {
                "type": "sql_result",
                "sql": sql,
                "explanation": explanation,
                "columns": result.get("columns", []),
                "rows": result.get("rows", []),
                "row_count": result.get("row_count", 0),
            }
        )
    }
    yield {"data": json.dumps({"type": "done", "content": content})}


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
