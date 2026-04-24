# aersa-copilot-backend

Backend for the TALOS Analytical Audit Copilot. See `../CLAUDE.md` for full architecture.

## Setup

```bash
# from this directory
cp ../.env.example ../.env       # then edit if needed
uv sync                          # creates .venv, installs deps from uv.lock
uv run python -m scripts.bootstrap_views   # apply SQL views to MariaDB
uv run python -m scripts.healthcheck       # verify DB + Ollama reachable
```

## Run (later sessions)

```bash
uv run uvicorn main:app --reload --port 8000
```
