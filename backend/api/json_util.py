"""JSON-safe encoding for API/SSE payloads (MariaDB Decimal, dates, etc.)."""
from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    return value


def dumps_sse(payload: dict[str, Any]) -> str:
    return json.dumps(json_safe(payload))
