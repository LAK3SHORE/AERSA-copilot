"""User model for analytics.db (CLAUDE.md §16.3)."""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Role(StrEnum):
    AUDITOR = "auditor"
    CORPORATIVO = "corporativo"


@dataclass(frozen=True, slots=True)
class User:
    id: int
    username: str
    role: Role
    idempresa: int | None
