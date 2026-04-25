"""Smoke test for the Ollama tool-calling agent (Session 4).

Drives `llm.agent.run_agent` with a single demo question (CLAUDE.md §13.3)
against the live MCP tools and Gemma. Prints the SSE event stream so a
human can verify:

  · Gemma streams tokens
  · Gemma calls the right tool(s)
  · Tool results flow back and Gemma synthesizes a final response

Run:
    uv run python -m scripts.test_agent
    uv run python -m scripts.test_agent "Explícame el hallazgo más crítico"
    uv run python -m scripts.test_agent "..." 956 2025-12
"""
from __future__ import annotations

import asyncio
import json
import sys
import time

from llm.agent import run_agent

DEFAULT_QUESTION = "¿Cuáles son los 3 hallazgos más críticos de este Cierre?"
DEFAULT_EMPRESA = 956
DEFAULT_PERIODO = "2025-12"


async def main_async(question: str, idempresa: int, periodo: str) -> int:
    print(f"\n[agent] empresa={idempresa} periodo={periodo}")
    print(f"[agent] user: {question}\n")
    print("─── stream ───────────────────────────────────────────────")

    t0 = time.perf_counter()
    n_tokens = 0
    n_tool_calls = 0
    final = ""

    async for evt in run_agent(idempresa, periodo, question):
        kind = evt.get("type")
        if kind == "token":
            sys.stdout.write(evt["content"])
            sys.stdout.flush()
            n_tokens += 1
        elif kind == "tool_call":
            n_tool_calls += 1
            args = json.dumps(evt.get("arguments") or {}, ensure_ascii=False)
            sys.stdout.write(f"\n  ⚙ tool_call → {evt['name']}({args})\n")
            sys.stdout.flush()
        elif kind == "tool_result":
            status = evt.get("status")
            err = f" error={evt.get('error')!r}" if status == "error" else ""
            sys.stdout.write(f"  ✓ tool_result ← {evt['name']} [{status}]{err}\n")
            sys.stdout.flush()
        elif kind == "done":
            final = evt.get("content", "")
        elif kind == "error":
            print(f"\n[agent] ERROR: {evt.get('message')}")
            return 1

    elapsed = time.perf_counter() - t0
    print("\n─── summary ──────────────────────────────────────────────")
    print(f"  elapsed         : {elapsed:6.2f} s")
    print(f"  token chunks    : {n_tokens}")
    print(f"  tool calls      : {n_tool_calls}")
    print(f"  final length    : {len(final)} chars")
    return 0


def main() -> int:
    args = sys.argv[1:]
    question = args[0] if len(args) >= 1 else DEFAULT_QUESTION
    idempresa = int(args[1]) if len(args) >= 2 else DEFAULT_EMPRESA
    periodo = args[2] if len(args) >= 3 else DEFAULT_PERIODO
    return asyncio.run(main_async(question, idempresa, periodo))


if __name__ == "__main__":
    sys.exit(main())
