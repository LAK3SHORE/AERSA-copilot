"""FastAPI auth dependencies (CLAUDE.md §16.5)."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from auth.crud import get_user_by_id
from auth.jwt import decode_token, token_to_user
from auth.models import Role, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        claims = decode_token(token)
        user = token_to_user(claims)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # Re-load from DB so revoked users fail (future); validates uid still exists.
    db_user = get_user_by_id(user.id)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return db_user


def require_role(*roles: Role):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Rol insuficiente",
            )
        return user

    return _check


def assert_empresa_access(user: User, idempresa: int) -> None:
    if user.role == Role.AUDITOR and user.idempresa != idempresa:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Empresa no autorizada",
        )


require_corporativo = require_role(Role.CORPORATIVO)
