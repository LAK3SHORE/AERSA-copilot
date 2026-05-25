"""Analytics + session logging smoke test (Session 10).

    uv run python -m scripts.bootstrap_analytics_db
    uv run python -m scripts.seed_users
    uv run uvicorn main:app --host 127.0.0.1 --port 8000
    uv run python -m scripts.test_analytics
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
        return str(json.loads(r.read().decode())["access_token"])


def _get(base: str, path: str, token: str) -> tuple[int, dict | list]:
    req = urllib.request.Request(
        f"{base}{path}",
        headers={"Accept": "application/json", "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:  # noqa: S310
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def _post_json(base: str, path: str, token: str, payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{base}{path}",
        data=data,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def _expect(cond: bool, msg: str) -> None:
    if not cond:
        raise SystemExit(f"FAIL: {msg}")
    print(f"  OK  {msg}")


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BASE
    print(f"[test_analytics] base={base}")

    tok_aud = _login(base, "auditor_956", "talos2026")
    status, cierre = _get(base, "/api/cierre/956/2025-12", tok_aud)
    _expect(status in (200, 404), "cierre load")
    if status != 200:
        print("  skip remaining (no cierre data)")
        return 0

    sid = cierre.get("audit_session_id")
    _expect(sid is not None and sid > 0, f"audit_session_id={sid}")

    status, brief = _get(base, f"/api/brief/956/2025-12?session_id={sid}", tok_aud)
    _expect(status == 200 and brief.get("action_count", 0) >= 1, "brief with actions")

    status, _ = _post_json(
        base,
        f"/api/sessions/{sid}/events",
        tok_aud,
        {
            "event_type": "anomaly_click",
            "payload": {
                "idinventariomesdetalle": cierre["top_anomalies"][0]["idinventariomesdetalle"],
                "severity_label": cierre["top_anomalies"][0]["severity_label"],
            },
        },
    )
    _expect(status == 200, "log anomaly_click")

    tok_admin = _login(base, "admin", "aersa2026")
    status, dash = _get(base, "/api/analytics/dashboard?days=30", tok_admin)
    _expect(status == 200 and "tools" in dash and "by_empresa" in dash, "dashboard bundle")

    status, overview = _get(base, "/api/analytics/overview", tok_admin)
    _expect(status == 200 and "total_sessions" in overview, "overview metrics")

    status, usage = _get(base, "/api/analytics/usage-summary?days=30", tok_admin)
    _expect(status == 200 and "by_tool" in usage, "usage-summary")

    status, sessions = _get(base, "/api/analytics/sessions", tok_admin)
    _expect(status == 200 and sessions.get("count", 0) >= 1, "sessions list")

    status, detail = _get(base, f"/api/analytics/sessions/{sid}", tok_admin)
    _expect(status == 200 and detail.get("id") == sid, "session detail")

    print("\n[test_analytics] All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
