"""GET /api/companies — top companies with finalised inventories (CLAUDE.md 9.1).

Ranks by raw inventory count so the demo always lands on a populated empresa
(956 leads with ~10.8K inventarios). The display name is synthesized as
"Empresa {id}" — TALOS does not expose a human-readable empresa.nombre in
this snapshot.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from api.models import CompanyOut
from auth.dependencies import get_current_user
from auth.models import Role, User
from db.queries.products import fetch_companies

router = APIRouter(prefix="/api", tags=["companies"])


def _to_company_out(r: dict) -> CompanyOut:
    return CompanyOut(
        idempresa=int(r["idempresa"]),
        nombre=f"Empresa {int(r['idempresa'])}",
        num_inventarios=int(r["num_inventarios"]),
    )


@router.get("/companies", response_model=list[CompanyOut])
def list_companies(
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
) -> list[CompanyOut]:
    try:
        rows = fetch_companies(limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"db_error: {exc}") from exc

    if user.role == Role.AUDITOR:
        if user.idempresa is None:
            raise HTTPException(status_code=403, detail="Auditor sin empresa asignada")
        matched = [r for r in rows if int(r["idempresa"]) == user.idempresa]
        if not matched:
            # Empresa may be outside top-N — fetch a single synthetic row.
            matched = [{"idempresa": user.idempresa, "num_inventarios": 0}]
        return [_to_company_out(matched[0])]

    return [_to_company_out(r) for r in rows]
