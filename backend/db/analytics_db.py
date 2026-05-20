"""SQLite engine for auth + analytics (Phase 2).

Separate from the read-only MariaDB TALOS connection. Writable.
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from config import settings

analytics_engine: Engine = create_engine(
    settings.analytics_db_url,
    connect_args={"check_same_thread": False},
    future=True,
)

AnalyticsSessionLocal = sessionmaker(
    bind=analytics_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    future=True,
)


@contextmanager
def analytics_session_scope() -> Iterator[Session]:
    session = AnalyticsSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def analytics_healthcheck() -> dict:
    with analytics_engine.connect() as conn:
        n_users = conn.execute(text("SELECT COUNT(*) FROM users")).scalar_one()
        return {"ok": True, "users": int(n_users)}
