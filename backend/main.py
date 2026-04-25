"""FastAPI app entry point (CLAUDE.md §9 + §5).

Wires the four route modules behind a single ASGI app, enables CORS for
the Vite dev server, and exposes a `/api/health` endpoint for the
docker-compose healthcheck.

Run:
    uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.models import HealthOut
from api.routes.chat import router as chat_router
from api.routes.cierre import router as cierre_router
from api.routes.companies import router as companies_router
from api.routes.periods import router as periods_router
from config import settings
from db.connection import healthcheck

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(
    title="AERSA Copilot API",
    version="0.0.1",
    description="TALOS Analytical Audit Copilot — HTTP + SSE surface.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(companies_router)
app.include_router(periods_router)
app.include_router(cierre_router)
app.include_router(chat_router)


@app.get("/api/health", response_model=HealthOut, tags=["health"])
def health() -> HealthOut:
    try:
        info = healthcheck()
        return HealthOut(ok=True, database=info)
    except Exception as exc:  # noqa: BLE001
        return HealthOut(ok=False, error=str(exc))
