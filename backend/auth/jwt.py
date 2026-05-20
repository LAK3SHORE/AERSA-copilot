"""JWT creation and verification (CLAUDE.md §16.4)."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from auth.models import Role, User
from config import settings


def create_access_token(user: User) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload: dict[str, Any] = {
        "sub": user.username,
        "role": user.role.value,
        "idempresa": user.idempresa,
        "uid": user.id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


def token_to_user(claims: dict[str, Any]) -> User:
    role_raw = claims.get("role")
    try:
        role = Role(role_raw)
    except ValueError as exc:
        raise JWTError("invalid role in token") from exc
    idempresa = claims.get("idempresa")
    uid = claims.get("uid")
    sub = claims.get("sub")
    if not sub or uid is None:
        raise JWTError("missing sub or uid in token")
    return User(
        id=int(uid),
        username=str(sub),
        role=role,
        idempresa=int(idempresa) if idempresa is not None else None,
    )
