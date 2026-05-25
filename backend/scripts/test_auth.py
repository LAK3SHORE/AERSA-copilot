"""Auth smoke test (Session 9 — CLAUDE.md §9.4).

    uv run python -m scripts.bootstrap_analytics_db
    uv run python -m scripts.seed_users
    uv run uvicorn main:app --host 127.0.0.1 --port 8000
    uv run python -m scripts.test_auth
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_BASE = "http://127.0.0.1:8000"


def _login(base: str, username: str, password: str) -> str:
    body = urllib.parse.urlencode({"username": username, "password": password}).encode()
    req = urllib.request.Request(
        f"{base}/api/auth/login",
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
        data = json.loads(r.read().decode())
    return str(data["access_token"])


def _get(base: str, path: str, token: str | None = None) -> tuple[int, dict | list | str]:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{base}{path}", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:  # noqa: S310
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = body
        return e.code, payload


def _expect(cond: bool, msg: str) -> None:
    if not cond:
        raise SystemExit(f"FAIL: {msg}")
    print(f"  OK  {msg}")


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BASE
    print(f"[test_auth] base={base}")

    status, _ = _get(base, "/api/companies")
    _expect(status == 401, "GET /api/companies without token → 401")

    tok_aud = _login(base, "auditor_956", "talos2026")
    status, me = _get(base, "/api/auth/me", tok_aud)
    _expect(status == 200 and me.get("role") == "auditor", "auditor /me")
    _expect(me.get("idempresa") == 956, "auditor idempresa=956")

    status, companies = _get(base, "/api/companies", tok_aud)
    _expect(status == 200 and len(companies) == 1, "auditor companies → 1 row")
    _expect(companies[0]["idempresa"] == 956, "auditor companies idempresa")

    status, _ = _get(base, "/api/cierre/956/2025-12", tok_aud)
    _expect(status in (200, 404), "auditor cierre 956 → allowed (200 or 404 no_data)")

    status, _ = _get(base, "/api/cierre/6/2025-12", tok_aud)
    _expect(status == 403, "auditor cierre empresa 6 → 403")

    status, _ = _get(base, "/api/analytics/overview", tok_aud)
    _expect(status == 403, "auditor analytics → 403")

    tok_admin = _login(base, "admin", "aersa2026")
    status, me = _get(base, "/api/auth/me", tok_admin)
    _expect(status == 200 and me.get("role") == "corporativo", "admin /me corporativo")

    status, _ = _get(base, "/api/cierre/6/2025-12", tok_admin)
    _expect(status in (200, 404), "admin cierre any empresa → allowed")

    status, overview = _get(base, "/api/analytics/overview", tok_admin)
    _expect(status == 200 and "total_sessions" in overview, "admin analytics overview")

    print("\n[test_auth] All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
