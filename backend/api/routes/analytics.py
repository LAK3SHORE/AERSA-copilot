"""Owner analytics routes — corporativo only (Session 10 fills metrics)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from auth.dependencies import require_corporativo
from auth.models import User

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
def analytics_overview(_user: User = Depends(require_corporativo)) -> dict:
    """Stub until Session 10 — proves role gate works."""
    return {
        "status": "stub",
        "message": "Métricas completas en Session 10 (interaction_logs + mcp_tool_events).",
    }
