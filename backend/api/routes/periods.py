"""GET /api/periods/{idempresa} — available cierre periods (CLAUDE.md 9.2).

Returns YYYY-MM strings descending. Source is the `inventario_full` view,
which already filters to estatus IN ('finalizado','aplicado','terminado').
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path

from auth.dependencies import assert_empresa_access, get_current_user
from auth.models import User
from db.queries.products import fetch_periods

router = APIRouter(prefix="/api", tags=["periods"])


@router.get("/periods/{idempresa}", response_model=list[str])
def list_periods(
    idempresa: int = Path(ge=1),
    user: User = Depends(get_current_user),
) -> list[str]:
    assert_empresa_access(user, idempresa)
    try:
        return fetch_periods(idempresa)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"db_error: {exc}") from exc
