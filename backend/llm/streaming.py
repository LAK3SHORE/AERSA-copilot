"""SSE event constructors for the chat stream (CLAUDE.md §9.4).

The agent yields these as plain dicts. The FastAPI route hands them to
`sse-starlette` (which serializes them as SSE `data:` frames). The test
script just prints them.

Event types:
  token        — one chunk of model output text
  tool_call    — the model invoked a tool ("running" status)
  tool_result  — the tool returned ("done" or "error" status)
  done         — agent finished (final assistant response)
  error        — fatal error during the run
"""
from __future__ import annotations

from typing import Any


def token_event(content: str) -> dict[str, Any]:
    return {"type": "token", "content": content}


def tool_call_event(name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"type": "tool_call", "name": name, "status": "running", "arguments": arguments or {}}


def tool_result_event(name: str, status: str = "done", error: str | None = None) -> dict[str, Any]:
    evt: dict[str, Any] = {"type": "tool_result", "name": name, "status": status}
    if error:
        evt["error"] = error
    return evt


def done_event(final_text: str) -> dict[str, Any]:
    return {"type": "done", "content": final_text}


def error_event(message: str) -> dict[str, Any]:
    return {"type": "error", "message": message}


__all__ = [
    "token_event",
    "tool_call_event",
    "tool_result_event",
    "done_event",
    "error_event",
]
