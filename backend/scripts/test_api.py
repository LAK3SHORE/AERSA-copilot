"""End-to-end smoke test for the FastAPI surface (Session 5).

Exercises every route against an already-running uvicorn process. Start
the server in another terminal first:

    uv run uvicorn main:app --host 127.0.0.1 --port 8000

Then:

    uv run python -m scripts.test_api
    uv run python -m scripts.test_api 956 2025-12

Validates:
  · GET  /api/health
  · GET  /api/companies
  · GET  /api/periods/{empresa}
  · GET  /api/cierre/{empresa}/{periodo}
  · POST /api/chat   (SSE — collects events until "done")
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any

DEFAULT_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_EMPRESA = 956
DEFAULT_PERIODO = "2025-12"
DEFAULT_QUESTION = "¿Cuál es el hallazgo más crítico?"


def _get_json(url: str, timeout: float = 60.0) -> Any:
    with urllib.request.urlopen(url, timeout=timeout) as r:  # noqa: S310 (local URL)
        return json.loads(r.read().decode("utf-8"))


def _post_sse(url: str, body: dict, timeout: float = 180.0) -> list[dict]:
    """Stream SSE response, return collected events (one dict per `data:` line)."""
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
    )
    events: list[dict] = []
    with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310
        for raw in r:
            line = raw.decode("utf-8").rstrip("\n")
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if not payload:
                continue
            try:
                events.append(json.loads(payload))
            except json.JSONDecodeError:
                events.append({"type": "raw", "content": payload})
    return events


def _hr(label: str) -> None:
    print(f"\n─── {label} {'─' * (60 - len(label))}")


def main() -> int:
    base = DEFAULT_BASE_URL
    empresa = int(sys.argv[1]) if len(sys.argv) >= 2 else DEFAULT_EMPRESA
    periodo = sys.argv[2] if len(sys.argv) >= 3 else DEFAULT_PERIODO
    question = sys.argv[3] if len(sys.argv) >= 4 else DEFAULT_QUESTION

    print(f"[api] base={base} empresa={empresa} periodo={periodo}")

    # 1. /api/health
    _hr("GET /api/health")
    t0 = time.perf_counter()
    health = _get_json(f"{base}/api/health")
    print(f"  ok={health.get('ok')} elapsed_ms={(time.perf_counter() - t0) * 1000:.1f}")
    if health.get("database"):
        print(f"  db.version={health['database'].get('version')}")
    if not health.get("ok"):
        print(f"  error={health.get('error')}")
        return 1

    # 2. /api/companies
    _hr("GET /api/companies")
    t0 = time.perf_counter()
    companies = _get_json(f"{base}/api/companies?limit=5")
    print(f"  count={len(companies)} elapsed_ms={(time.perf_counter() - t0) * 1000:.1f}")
    for c in companies[:3]:
        print(f"    · {c['idempresa']:>5}  {c['nombre']}  ({c['num_inventarios']} inv)")

    # 3. /api/periods/{empresa}
    _hr(f"GET /api/periods/{empresa}")
    t0 = time.perf_counter()
    periods = _get_json(f"{base}/api/periods/{empresa}")
    print(f"  count={len(periods)} elapsed_ms={(time.perf_counter() - t0) * 1000:.1f}")
    print(f"  first 5 = {periods[:5]}")

    # 4. /api/cierre/{empresa}/{periodo}
    _hr(f"GET /api/cierre/{empresa}/{periodo}")
    t0 = time.perf_counter()
    try:
        report = _get_json(f"{base}/api/cierre/{empresa}/{periodo}", timeout=60)
    except urllib.error.HTTPError as exc:  # noqa: PERF203
        print(f"  HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}")
        return 1
    elapsed_ms = (time.perf_counter() - t0) * 1000
    kpis = report["kpis"]
    print(f"  elapsed_ms={elapsed_ms:.1f}  generated_at={report['generated_at']}")
    print(f"  num_almacenes={kpis['num_almacenes']}  num_productos={kpis['num_productos']}")
    print(f"  total_faltantes_mxn=${kpis['total_faltantes_mxn']:,.2f}")
    print(f"  total_anomalies_found={report['total_anomalies_found']}")
    print(f"  top_anomalies={len(report['top_anomalies'])}")
    if report["top_anomalies"]:
        a = report["top_anomalies"][0]
        print(
            f"  #1: [{a['severity_label']}] {a['producto_nombre']}  "
            f"impact=${a['financial_impact_mxn']:,.2f} z={a['z_score']!r}"
        )

    # 5. /api/chat (SSE)
    _hr("POST /api/chat (SSE)")
    t0 = time.perf_counter()
    events = _post_sse(
        f"{base}/api/chat",
        {"idempresa": empresa, "periodo": periodo, "message": question, "history": []},
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000
    n_token = sum(1 for e in events if e.get("type") == "token")
    n_tool = sum(1 for e in events if e.get("type") == "tool_call")
    final = next((e for e in reversed(events) if e.get("type") == "done"), None)
    err = next((e for e in events if e.get("type") == "error"), None)
    print(f"  elapsed_ms={elapsed_ms:.1f}  events={len(events)}")
    print(f"  token chunks={n_token}  tool_calls={n_tool}")
    if err:
        print(f"  ERROR: {err.get('message')}")
        return 1
    if final:
        snippet = (final.get("content") or "").strip().replace("\n", " ")
        if len(snippet) > 240:
            snippet = snippet[:240] + "…"
        print(f"  final: {snippet}")

    print("\n[api] all endpoints OK ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
