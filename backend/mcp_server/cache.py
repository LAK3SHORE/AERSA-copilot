"""TTL-cached accessor for CierreReport.

The full report is expensive to build (~5s on empresa 956, §14). A single
chat turn often triggers multiple tool calls against the same (empresa,
periodo), so we memoize per (idempresa, periodo, top_n) for
`settings.cierre_cache_ttl_seconds` (default 600s, CLAUDE.md §11).
"""
from __future__ import annotations

from cachetools import TTLCache

from config import settings
from engine.report import CierreReport, build_cierre_report

_CACHE: TTLCache[tuple[int, str, int], CierreReport] = TTLCache(
    maxsize=32,
    ttl=settings.cierre_cache_ttl_seconds,
)


def get_or_build_cierre_report(
    idempresa: int,
    periodo: str,
    top_n: int = 20,
) -> CierreReport:
    key = (idempresa, periodo, top_n)
    cached = _CACHE.get(key)
    if cached is not None:
        return cached
    report = build_cierre_report(idempresa, periodo, top_n=top_n)
    _CACHE[key] = report
    return report


def invalidate(idempresa: int | None = None, periodo: str | None = None) -> int:
    """Evict cached entries. Returns the number of entries removed."""
    if idempresa is None and periodo is None:
        n = len(_CACHE)
        _CACHE.clear()
        return n
    to_drop = [
        k for k in list(_CACHE.keys())
        if (idempresa is None or k[0] == idempresa)
        and (periodo is None or k[1] == periodo)
    ]
    for k in to_drop:
        _CACHE.pop(k, None)
    return len(to_drop)


__all__ = ["get_or_build_cierre_report", "invalidate"]
