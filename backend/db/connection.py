"""SQLAlchemy engine + session factory for the read-only TALOS connection.

Per CLAUDE.md 15: all DB work is read-only. The engine is configured with
`pool_pre_ping=True` so stale connections are detected after MariaDB restarts.
Use `session_scope()` for short-lived queries and `engine` for pandas reads.
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from config import settings

engine: Engine = create_engine(
    settings.db_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    future=True,
    # Read-only intent — no autoflush, no expire_on_commit needed for SELECTs.
    isolation_level="READ COMMITTED",
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    future=True,
)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Yield a session; always close. Never commit (read-only)."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def healthcheck() -> dict:
    """Return basic DB facts. Raises SQLAlchemyError if connection fails."""
    with engine.connect() as conn:
        version = conn.execute(text("SELECT VERSION()")).scalar_one()
        db_name = conn.execute(text("SELECT DATABASE()")).scalar_one()
        n_inv_detail = conn.execute(
            text("SELECT COUNT(*) FROM inventariomesdetalle")
        ).scalar_one()
        return {
            "ok": True,
            "version": version,
            "database": db_name,
            "inventariomesdetalle_rows": int(n_inv_detail),
        }


if __name__ == "__main__":
    import json

    print(json.dumps(healthcheck(), indent=2, default=str))
