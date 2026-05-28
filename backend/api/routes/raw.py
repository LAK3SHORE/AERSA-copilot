"""GET /api/raw/cierre — corporativo raw inventory rows (Session 15)."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query

from api.models import RawCierreOut
from auth.dependencies import require_corporativo
from auth.models import User
from db.queries.raw import ALLOWED_TABLAS, fetch_raw_cierre_rows

router = APIRouter(tags=["raw"])

_PERIODO_RE = re.compile(r"^\d{4}-\d{2}$")


@router.get("/cierre", response_model=RawCierreOut)
def get_raw_cierre(
    idempresa: int = Query(..., ge=1),
    periodo: str = Query(..., min_length=7, max_length=7),
    tabla: str = Query(default="cierre_detalle"),
    limit: int = Query(default=2000, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_corporativo),
) -> RawCierreOut:
    if not _PERIODO_RE.match(periodo):
        raise HTTPException(status_code=400, detail="periodo must be YYYY-MM")
    if tabla not in ALLOWED_TABLAS:
        raise HTTPException(
            status_code=400,
            detail=f"tabla no soportada: {tabla}. Disponible: {sorted(ALLOWED_TABLAS)}",
        )

    try:
        rows, total = fetch_raw_cierre_rows(
            idempresa, periodo, limit=limit, offset=offset
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"raw_query_error: {exc}") from exc

    return RawCierreOut(
        tabla=tabla,
        idempresa=idempresa,
        periodo=periodo,
        total_rows=total,
        rows=rows,
    )
