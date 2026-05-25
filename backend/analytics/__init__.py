"""Analytics DB: sessions, interaction logs, MCP metrics, findings."""

from analytics.findings import get_statuses_for_lines, upsert_finding_status
from analytics.logging import end_session, log_event, start_session
from analytics.mcp_tracking import record_tool_event
from analytics.metrics import (
    aggregate_overview,
    coverage_score,
    question_depth_score,
    session_detail,
    sessions_list,
    usage_summary,
)

__all__ = [
    "aggregate_overview",
    "coverage_score",
    "end_session",
    "get_statuses_for_lines",
    "log_event",
    "question_depth_score",
    "record_tool_event",
    "session_detail",
    "sessions_list",
    "start_session",
    "upsert_finding_status",
    "usage_summary",
]
