"""Tool-calling agent loop against Ollama `gemma4:e4b` (CLAUDE.md §8.2).

Streams an SSE event dict for every token, every tool invocation, and the
final response. The MCP tools are imported in-process (no subprocess
needed for v0 — see CLAUDE.md §7.1).

Public API: `run_agent(...)` is an async generator that yields events.
Callers (the FastAPI chat route, the test script) iterate it and either
forward the events as SSE frames or print them.
"""
from __future__ import annotations

import asyncio
import inspect
import json
import logging
import time
from typing import Any, AsyncIterator

import ollama

from config import settings
from llm.prompts import build_system_prompt
from llm.streaming import (
    done_event,
    error_event,
    token_event,
    tool_call_event,
    tool_result_event,
)
from llm.tool_schemas import get_ollama_tool_schemas
from mcp_server.server import TOOL_REGISTRY

log = logging.getLogger("llm.agent")

MAX_TOOL_ROUNDS = 5


def _normalize_args(raw: Any) -> dict[str, Any]:
    """Tool calls from Ollama can arrive as dict, BaseModel, or JSON string."""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    if hasattr(raw, "model_dump"):
        return raw.model_dump()
    try:
        return dict(raw)
    except (TypeError, ValueError):
        return {}


def _inject_context(
    tool_name: str,
    args: dict[str, Any],
    idempresa: int,
    periodo: str,
) -> dict[str, Any]:
    """Fill in idempresa/periodo when Gemma forgets — a common 8B failure mode.

    Only injects if the target tool actually accepts that parameter.
    """
    fn = TOOL_REGISTRY.get(tool_name)
    if fn is None:
        return args
    try:
        sig = inspect.signature(fn)
    except (TypeError, ValueError):
        return args
    params = sig.parameters
    out = dict(args)
    if "idempresa" in params and "idempresa" not in out:
        out["idempresa"] = idempresa
    if "periodo" in params and "periodo" not in out:
        out["periodo"] = periodo
    return out


def _coerce_arg_types(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Best-effort type coercion. Gemma sometimes passes ints as strings."""
    fn = TOOL_REGISTRY.get(tool_name)
    if fn is None:
        return args
    try:
        hints = inspect.get_annotations(fn, eval_str=True)
    except Exception:  # noqa: BLE001
        return args
    out = dict(args)
    for k, v in list(out.items()):
        target = hints.get(k)
        if target is int and isinstance(v, str):
            try:
                out[k] = int(v.strip())
            except ValueError:
                pass
        elif target is str and not isinstance(v, str) and v is not None:
            out[k] = str(v)
    return out


async def _execute_tool(
    name: str,
    args: dict[str, Any],
    idempresa: int,
    periodo: str,
) -> dict[str, Any]:
    fn = TOOL_REGISTRY.get(name)
    if fn is None:
        return {"error": "unknown_tool", "message": f"Tool '{name}' no existe."}
    args = _coerce_arg_types(name, _inject_context(name, args, idempresa, periodo))
    try:
        # MCP tools are sync (SQLAlchemy I/O). Run in a thread so we don't
        # stall the event loop during the ~5s first-call report build.
        return await asyncio.to_thread(fn, **args)
    except TypeError as exc:
        return {"error": "bad_arguments", "message": f"{exc}"}
    except Exception as exc:  # noqa: BLE001
        log.exception("tool %s failed", name)
        return {"error": "tool_error", "message": str(exc)}


async def _collect_streamed_response(
    stream: AsyncIterator[Any],
) -> AsyncIterator[dict[str, Any]]:
    """Yield token events as Gemma streams them; accumulate any tool_calls
    and emit a final '__assistant_message' event with the complete payload.
    """
    text_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []

    async for chunk in stream:
        msg = getattr(chunk, "message", None)
        if msg is None:
            continue
        content = getattr(msg, "content", None)
        if content:
            text_parts.append(content)
            yield token_event(content)
        tcs = getattr(msg, "tool_calls", None)
        if tcs:
            for tc in tcs:
                fn = getattr(tc, "function", None)
                if fn is None:
                    continue
                tool_calls.append({
                    "name": getattr(fn, "name", ""),
                    "arguments": _normalize_args(getattr(fn, "arguments", None)),
                })

    yield {
        "__internal__": True,
        "text": "".join(text_parts),
        "tool_calls": tool_calls,
    }


async def run_agent(
    idempresa: int,
    periodo: str,
    user_message: str,
    history: list[dict[str, Any]] | None = None,
    num_almacenes: int | None = None,
    model: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Async generator: drives the Gemma tool-calling loop, yields SSE events."""
    history = list(history or [])
    model = model or settings.ollama_model

    client = ollama.AsyncClient(host=settings.ollama_host)
    tools = await get_ollama_tool_schemas()
    system = build_system_prompt(idempresa, periodo, num_almacenes)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        *history,
        {"role": "user", "content": user_message},
    ]

    final_text = ""

    for round_num in range(MAX_TOOL_ROUNDS):
        t0 = time.perf_counter()
        try:
            stream = await client.chat(
                model=model,
                messages=messages,
                tools=tools,
                stream=True,
                think=False,
                options={"temperature": 0.2, "num_ctx": 8192},
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("Ollama chat failed")
            yield error_event(f"LLM no disponible: {exc}")
            return

        round_text = ""
        round_tool_calls: list[dict[str, Any]] = []
        async for evt in _collect_streamed_response(stream):
            if evt.get("__internal__"):
                round_text = evt["text"]
                round_tool_calls = evt["tool_calls"]
            else:
                yield evt

        log.info(
            "agent.round=%d elapsed_ms=%.1f tool_calls=%d text_chars=%d",
            round_num,
            (time.perf_counter() - t0) * 1000,
            len(round_tool_calls),
            len(round_text),
        )

        assistant_msg: dict[str, Any] = {"role": "assistant", "content": round_text}
        if round_tool_calls:
            assistant_msg["tool_calls"] = [
                {"function": {"name": tc["name"], "arguments": tc["arguments"]}}
                for tc in round_tool_calls
            ]
        messages.append(assistant_msg)

        if not round_tool_calls:
            final_text = round_text
            break

        # Execute every tool call in this round, append results, loop again.
        for tc in round_tool_calls:
            yield tool_call_event(tc["name"], tc["arguments"])
            result = await _execute_tool(tc["name"], tc["arguments"], idempresa, periodo)
            status = "error" if isinstance(result, dict) and "error" in result else "done"
            yield tool_result_event(tc["name"], status, result.get("message") if status == "error" else None)
            messages.append({
                "role": "tool",
                "name": tc["name"],
                "content": json.dumps(result, ensure_ascii=False, default=str),
            })
    else:
        # Hit the round limit without a final response — synthesize one.
        final_text = (
            round_text
            or "Llegué al límite de invocaciones de herramientas sin una respuesta final. "
            "Reformula tu pregunta o pide un resumen más acotado."
        )

    yield done_event(final_text)


__all__ = ["run_agent", "MAX_TOOL_ROUNDS"]
