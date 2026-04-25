"""GET /api/companies — top companies with finalised inventories (CLAUDE.md §9.1).

Ranks by raw inventory count so the demo always lands on a populated empresa
(956 leads with ~10.8K inventarios). The display name is synthesized as
"Empresa {id}" — TALOS does not expose a human-readable empresa.nombre in
this snapshot.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from api.models import CompanyOut
from db.queries.products import fetch_companies

router = APIRouter(prefix="/api", tags=["companies"])


@router.get("/companies", response_model=list[CompanyOut])
def list_companies(limit: int = Query(default=10, ge=1, le=50)) -> list[CompanyOut]:
    try:
        rows = fetch_companies(limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"db_error: {exc}") from exc
    return [
        CompanyOut(
            idempresa=int(r["idempresa"]),
            nombre=f"Empresa {int(r['idempresa'])}",
            num_inventarios=int(r["num_inventarios"]),
        )
        for r in rows
    ]
