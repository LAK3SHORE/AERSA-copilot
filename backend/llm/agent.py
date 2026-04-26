"""Tool-calling agent loop against Ollama `gemma4:e4b` (CLAUDE.md 8.2).

Streams an SSE event dict for tool invocations and for the final
synthesized response. The MCP tools are imported in-process (no
subprocess needed for v0 — see CLAUDE.md 7.1).

Token policy (locked 2026-04-25 after demo bug-hunt):

Gemma streams pre-tool-call deliberation as plain `message.content`
(typically English chain-of-thought, hundreds of tokens). Forwarding that
to the user blew up perceived latency to >90s and left the chat panel
showing English thinking instead of the answer (CLAUDE.md 14 polish
note). So we BUFFER content per round and only flush it as `token` events
on the *synthesis* round (the round with no tool calls). Tool-call rounds
have their content dropped — the user only sees `tool_call` /
`tool_result` indicators while the model is deciding what to fetch.

Empty-synthesis fallback: small models occasionally emit zero tokens
after a tool returns. We retry once with a forcing user nudge; if that
also produces nothing, we return a clear Spanish fallback message rather
than an empty bubble.

Public API: `run_agent(...)` is an async generator that yields events.
Callers (the FastAPI chat route, the test script) iterate it and either
forward the events as SSE frames or print them.
"""
from __future__ import annotations

import asyncio
import inspect
import json
import logging
import re
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


async def _collect_response(
    stream: AsyncIterator[Any],
) -> tuple[str, list[dict[str, Any]]]:
    """Drain a streaming chat response; return (full_text, tool_calls).

    No events are yielded user-ward — the caller decides whether the
    accumulated text is deliberation (drop) or synthesis (flush).
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

    return "".join(text_parts), tool_calls


def _chunk_for_streaming(text: str, size: int = 8) -> list[str]:
    """Slice the synthesized answer so the frontend renders progressively.

    SSE frames flush per yield, so emitting many small frames lets React
    paint as text arrives instead of dumping the whole answer in one tick.
    """
    if not text:
        return []
    return [text[i : i + size] for i in range(0, len(text), size)]


# ─── Synthesis sanitiser ───────────────────────────────────────────────
# Gemma3/4 occasionally emit two kinds of garbage at the start of a
# synthesis turn (CLAUDE.md 14 Session-4 polish notes):
#   1. A "fake tool call" — a fenced code block with JSON like
#      ```json { "tool_name": "...", "parameters": {...} } ```
#      which the model wrote instead of issuing a structured tool_call.
#   2. Chat-template tokens leaking through the tokenizer:
#      <channel|>, <|channel|>, <|message|>, etc.
# Strip both before streaming user-ward (and before storing in history,
# so follow-up turns don't see the artifacts).
_LEADING_FENCE_RE = re.compile(r"^\s*```[^\n]*\n.*?```\s*", re.DOTALL)
_TEMPLATE_ARTIFACT_RE = re.compile(
    r"<\|?(?:channel|message|tool|end|start|im_start|im_end)\|?>"
)


def _sanitize_synthesis(text: str) -> str:
    cleaned = text
    # Strip any number of leading code fences (Gemma occasionally chains them).
    while True:
        m = _LEADING_FENCE_RE.match(cleaned)
        if not m:
            break
        cleaned = cleaned[m.end():]
    cleaned = _TEMPLATE_ARTIFACT_RE.sub("", cleaned)
    return cleaned.strip()


_NUDGE_MESSAGE = (
    "Por favor responde ahora la pregunta del auditor en español usando los datos "
    "que ya consultaste con las herramientas. No hagas más llamadas a herramientas."
)
_FALLBACK_EMPTY = (
    "No pude generar una respuesta tras consultar las herramientas. "
    "Reformula la pregunta o pide un detalle más específico."
)
_FALLBACK_LIMIT = (
    "Llegué al límite de llamadas a herramientas sin sintetizar una respuesta. "
    "Reformula tu pregunta o pide un resumen más acotado."
)


async def run_agent(
    idempresa: int,
    periodo: str,
    user_message: str,
    history: list[dict[str, Any]] | None = None,
    num_almacenes: int | None = None,
    model: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Async generator: drives the Gemma tool-calling loop, yields SSE events.

    Round semantics:
      · Tool-call round  → drop content (deliberation), emit tool_call and
        tool_result events, append tool result to messages, loop.
      · Synthesis round  → flush content as `token` events, then break.
      · Empty synthesis  → nudge once with a forcing user message; if the
        retry is also empty, emit `_FALLBACK_EMPTY`.
      · Round limit hit  → emit `_FALLBACK_LIMIT`.
    """
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
    nudge_used = False

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

        round_text, round_tool_calls = await _collect_response(stream)

        log.info(
            "agent.round=%d elapsed_ms=%.1f tool_calls=%d text_chars=%d nudged=%s",
            round_num,
            (time.perf_counter() - t0) * 1000,
            len(round_tool_calls),
            len(round_text),
            nudge_used,
        )

        # ─── Synthesis round (no tool calls) ────────────────────────────
        if not round_tool_calls:
            cleaned = _sanitize_synthesis(round_text)
            if cleaned:
                # Real answer — record sanitised text in history and stream
                # user-ward. We store the cleaned version so follow-up turns
                # don't carry the template artifacts forward.
                messages.append({"role": "assistant", "content": cleaned})
                final_text = cleaned
                for chunk in _chunk_for_streaming(cleaned):
                    yield token_event(chunk)
                break
            if not nudge_used:
                # Empty synthesis after tool calls. Nudge Gemma once.
                # We deliberately do NOT push the empty assistant turn —
                # some chat templates choke on it. Just inject the user
                # forcing message and re-roll the round.
                nudge_used = True
                messages.append({"role": "user", "content": _NUDGE_MESSAGE})
                continue
            # Already nudged once — don't loop forever. Fall back.
            final_text = _FALLBACK_EMPTY
            yield token_event(final_text)
            break

        # ─── Tool-call round (deliberation dropped) ─────────────────────
        # Preserve round_text in the assistant turn for model coherence,
        # but never stream it user-ward.
        messages.append({
            "role": "assistant",
            "content": round_text,
            "tool_calls": [
                {"function": {"name": tc["name"], "arguments": tc["arguments"]}}
                for tc in round_tool_calls
            ],
        })
        for tc in round_tool_calls:
            yield tool_call_event(tc["name"], tc["arguments"])
            result = await _execute_tool(tc["name"], tc["arguments"], idempresa, periodo)
            status = "error" if isinstance(result, dict) and "error" in result else "done"
            yield tool_result_event(
                tc["name"],
                status,
                result.get("message") if status == "error" else None,
            )
            messages.append({
                "role": "tool",
                "name": tc["name"],
                "content": json.dumps(result, ensure_ascii=False, default=str),
            })
    else:
        # Exhausted MAX_TOOL_ROUNDS without breaking out.
        final_text = _FALLBACK_LIMIT
        yield token_event(final_text)

    yield done_event(final_text)


__all__ = ["run_agent", "MAX_TOOL_ROUNDS"]
