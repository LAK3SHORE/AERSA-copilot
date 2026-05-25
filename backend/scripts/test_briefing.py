"""Guided briefing smoke test (Session 11).

    uv run uvicorn main:app --host 127.0.0.1 --port 8000
    uv run python -m scripts.test_briefing
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request

DEFAULT_BASE = "http://127.0.0.1:8000"


def _login(base: str) -> str:
    body = urllib.parse.urlencode({"username": "auditor_956", "password": "talos2026"}).encode()
    req = urllib.request.Request(
        f"{base}/api/auth/login",
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
        return str(json.loads(r.read().decode())["access_token"])


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BASE
    tok = _login(base)
    req = urllib.request.Request(
        f"{base}/api/brief/956/2025-12",
        headers={"Authorization": f"Bearer {tok}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:  # noqa: S310
        data = json.loads(r.read().decode())

    actions = data.get("actions") or []
    if not actions:
        print("FAIL: no briefing actions")
        return 1
    print(f"OK headline: {data.get('headline', '')[:80]}...")
    print(f"OK actions: {len(actions)} — first: {actions[0].get('title')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
