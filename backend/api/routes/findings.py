"""Finding status routes (Session 12)."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel

from analytics.findings import upsert_finding_status
from analytics.logging import log_event
from auth.dependencies import assert_empresa_access, get_current_user, require_role
from auth.models import Role, User

router = APIRouter(prefix="/api/findings", tags=["findings"])


class FindingStatusIn(BaseModel):
    status: Literal["pendiente", "revisado", "escalado"]
    session_id: int | None = None
    idempresa: int | None = None


@router.patch("/{idinventariomesdetalle}/status")
def patch_finding_status(
    idinventariomesdetalle: int = Path(ge=1),
    body: FindingStatusIn = ...,
    user: User = Depends(require_role(Role.AUDITOR)),
) -> dict:
    if body.idempresa is not None:
        assert_empresa_access(user, body.idempresa)
    try:
        result = upsert_finding_status(
            user.id,
            idinventariomesdetalle,
            body.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if body.session_id is not None:
        log_event(
            body.session_id,
            user.id,
            "finding_status_change",
            {
                "idinventariomesdetalle": idinventariomesdetalle,
                "old_status": result.get("old_status"),
                "new_status": body.status,
            },
        )

    return {
        "idinventariomesdetalle": idinventariomesdetalle,
        "status": body.status,
        "old_status": result.get("old_status"),
    }
