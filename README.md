# AERSA Copilot

> **TALOS Analytical Audit Copilot** — a domain-specific analytical copilot for inventory auditing in the Mexican restaurant industry.
> MA3001B · Tec de Monterrey × **AERSA** (Asesoría Enfocada a Resultados)

AERSA's platform **TALOS** centralizes operational, financial, and inventory data for multi-branch food & beverage businesses. Its most critical process is the **Cierre de Semana** (Weekly Close): reconciling initial inventory, purchases, internal transfers (requisitions), sales, and final physical counts per warehouse and period.

Interpreting that close today depends entirely on experienced auditors reading tabular data by hand — there is no automated anomaly detection or prioritization. AERSA Copilot closes that gap with a **pre-computed analytical engine** + a **local LLM agent** that answers auditors' questions in natural language, grounded only in domain-specific tools (never raw SQL).

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Running the stack](#running-the-stack)
- [Demo users](#demo-users)
- [Smoke tests](#smoke-tests)
- [API reference](#api-reference)
- [MCP tools](#mcp-tools)
- [Analytical engine — key formulas](#analytical-engine--key-formulas)
- [Domain glossary](#domain-glossary)
- [Conventions & gotchas](#conventions--gotchas)
- [Project status](#project-status)

---

## What it does

Two roles, one shell:

### Auditor (`auditor`)
One per restaurant company (`idempresa`); scoped to their own company only.

- **Contexto** — load a Cierre (`empresa` + `periodo`), see KPIs and a **Guided Briefing** answering *"¿Por dónde empiezo a analizar estos datos?"*
- **Hallazgos** — ranked anomalies (z-score vs. 12-period baseline, weighted by financial impact); click any finding to chat about it. Findings carry `finding_context`, so the agent calls the right tools without re-asking for IDs/period.
- **Generador de Reporte** — composes briefing + shrinkage breakdowns + top findings into an HTML/PDF export.
- **Copiloto chat** — collapsible drawer; the Ollama agent answers via MCP tools only.

### Corporativo (`corporativo`, demo user `admin`)
Full access; owner/adoption view.

- **Panel de Adopción** — usage KPIs (MCP calls/session, chat messages), MCP-tool bar chart, per-empresa / per-auditor tables, CSV export. Clicking a bar/row opens an owner analytics chat.
- **Vista Auditor** — the full auditor experience for any company.
- **Datos Raw** — paginated, engine-enriched inventory rows with column filters + CSV. A **NL→SQL** drawer (`CONSULTA · SQL`) turns plain-Spanish questions into read-only SELECTs; **VER EN DATOS RAW** bridges the query result back into the raw table as a cross-filter (sorted by financial impact).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                     │
│  Auditor: Contexto · Briefing · Hallazgos · Reporte · Chat     │
│  Corporativo: AdminView (Adopción · Vista Auditor · Datos Raw) │
│  Login · collapsible Chat Drawer (audit | analytics | sql)     │
│                     http://localhost:5173                      │
└─────────────────────────────┬────────────────────────────────┘
                              │ HTTP / SSE
┌─────────────────────────────▼────────────────────────────────┐
│                        FastAPI Backend                        │
│  /api/cierre  /api/brief  /api/chat (SSE)                     │
│  /api/chat/corporativo (SSE)  /api/analytics/*               │
│  /api/raw/cierre  /api/query/nl2sql (SSE)                    │
│  /api/report/{empresa}/{periodo}  /api/findings/*            │
│                     http://localhost:8000                      │
└──────┬──────────────────┬────────────────────┬───────────────┘
       │                  │                    │
       ▼                  ▼                    ▼
   JWT Auth          LLM Agent            Analytics DB
   (SQLite)       (Ollama, local)          (SQLite)
                       │
                       ▼ tool calls (MCP, 5 tools)
┌──────────────────────────────────────────────────────────────┐
│                  MCP Server (backend/mcp_server/)             │
│  get_cierre_summary · get_top_anomalies · get_product_history │
│  get_category_shrinkage · generate_audit_brief               │
└──────────────────────────┬───────────────────────────────────┘
                           │ read-only SQL
┌──────────────────────────▼───────────────────────────────────┐
│                Analytical Engine + Briefing                   │
│      CierreReport · anomaly scoring · build_audit_brief       │
└──────────────────────────┬───────────────────────────────────┘
                           │ read-only SQL
┌──────────────────────────▼───────────────────────────────────┐
│              TALOS MariaDB (read-only to us)                  │
│         ~11.7M inventory rows · Oct 2016 – Apr 2026           │
└──────────────────────────────────────────────────────────────┘
```

**Architectural contracts (locked):**

- **The LLM never touches raw SQL.** The auditor agent calls MCP tools only; tools return pre-processed, business-contextualized data. *(NL→SQL on Datos Raw is a separate, corporativo-only, SELECT-only, `LIMIT`-capped path — not the agent.)*
- **The analytical engine is not a chatbot.** It encodes auditing domain logic (what counts as anomalous shrinkage, how to rank by impact, how to baseline against history).
- **The MCP server is the only boundary.** All domain logic lives below it; the LLM only sees tool outputs.
- **All writes go to `analytics.db`.** TALOS MariaDB is strictly read-only; sessions, logs, MCP metrics, finding status, and users live in SQLite.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| LLM | Ollama `gemma4:e4b` (local) | Fully on-device, no API keys, no external calls |
| Backend | FastAPI + `sse-starlette` | Async, first-class SSE streaming |
| Data engine | pandas / numpy / scipy / scikit-learn | Vectorized anomaly scoring |
| Tool protocol | `mcp` Python SDK (FastMCP) | Standard tool-calling boundary |
| Frontend | React 18 + Vite + TypeScript + Tailwind | Fast dev, SSE-friendly |
| Charts / export | Recharts · html2canvas · jsPDF | KPI charts + PDF report export |
| Auth | JWT (`python-jose`) + `bcrypt` | Stateless, simple |
| Source DB | MariaDB (TALOS, read-only) | Client's system of record |
| App DB | SQLite (`analytics.db`) | All app-owned writes |
| Python pkg mgmt | **`uv`** (lockfile) | Fast, reproducible — never `pip install` |
| Python | 3.12 (resolved from `>=3.11,<3.14`) | |

---

## Repository layout

```
AERSA-copilot/
├── CLAUDE.md                 # Runtime cheat sheet / conventions (source of truth)
├── README.md                 # You are here
├── .env.example              # Copy to .env and fill in
├── backend/
│   ├── main.py               # FastAPI app — registers all routers
│   ├── config.py             # pydantic-settings (.env)
│   ├── db/                   # MariaDB pool, SQLite engine, views.sql
│   ├── engine/               # report.py · anomaly.py · brief.py (domain logic)
│   ├── mcp_server/           # ⚠ NOT mcp/ — FastMCP server + tools/
│   ├── llm/                  # agent.py · prompts.py · nl2sql.py · tool_labels.py
│   ├── auth/                 # JWT, crud, dependencies
│   ├── analytics/            # logging, mcp_tracking, metrics, findings
│   ├── api/                  # json_util.py, models.py, routes/
│   └── scripts/              # bootstrap_*, seed_*, test_* (run via uv)
└── frontend/
    └── src/
        ├── components/       # AppShell, layout/, chat/, auditor/, admin/
        ├── hooks/useAppChat.ts
        ├── lib/              # sqlToRawFilter.ts, toolsCatalog.ts, reportExport.ts
        ├── api/              # cierre, chat, analytics, raw, report
        └── types/            # cierre.ts, analytics.ts, raw.ts, report.ts
```

> **Module-path warning:** the MCP package lives at `backend/mcp_server/`, **not** `backend/mcp/` — naming it `mcp/` shadows the `mcp` Python SDK. Import as `from mcp.server.fastmcp import FastMCP`.

---

## Prerequisites

- **[uv](https://docs.astral.sh/uv/)** (Python package manager) — Python 3.12 will be resolved automatically.
- **Node.js 18+** and npm (for the frontend).
- **[Ollama](https://ollama.com/)** running locally with the model pulled:
  ```bash
  ollama pull gemma4:e4b      # model id used by the agent
  ```
- **MariaDB** with the TALOS database (`talos_tecmty`) reachable at `127.0.0.1:3306`.

---

## Setup

```bash
# 1. Environment file (repo root)
cp .env.example .env
# generate a JWT secret and paste it into .env (JWT_SECRET_KEY):
python -c "import secrets; print(secrets.token_hex(32))"

# 2. Backend
cd backend
uv sync                                         # creates .venv from uv.lock
uv run python -m scripts.bootstrap_views        # apply SQL views to MariaDB (idempotent)
uv run python -m scripts.bootstrap_analytics_db # create analytics.db tables
uv run python -m scripts.seed_users             # admin + auditor_956 (+ auditor_1024)
uv run python -m scripts.seed_analytics_demo    # corporativo dashboard demo data

# 3. Frontend
cd ../frontend
npm install
```

> ⚠️ `seed_analytics_demo` **wipes and reseeds** all activity tables — re-run it before a corporativo demo, but never against real captured usage.

---

## Environment variables

All config lives in the repo-root `.env` (see [.env.example](.env.example)). Key entries:

```bash
# MariaDB (TALOS — read-only)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=talos_tecmty

# Ollama (local LLM)
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:e4b

# App
BACKEND_PORT=8000
FRONTEND_PORT=5173
CORS_ORIGIN=http://localhost:5173

# Anomaly thresholds (tunable without code changes)
ANOMALY_ZSCORE_SOFT=2.0
ANOMALY_ZSCORE_HARD=3.0
ANOMALY_MIN_HISTORY_PERIODS=3
ANOMALY_ROLLING_WINDOW_MONTHS=12

# Auth (Phase 2)
JWT_SECRET_KEY=<python -c "import secrets; print(secrets.token_hex(32))">
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480
ANALYTICS_DB_PATH=analytics.db
```

---

## Running the stack

```bash
# Backend (from backend/)
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
#   → API + docs at http://127.0.0.1:8000/docs

# Frontend (from frontend/)
npm run dev
#   → app at http://localhost:5173  (proxies /api to the backend)
```

If port 8000 is busy, use `--port 8001` and update `DEFAULT_BASE_URL` in `scripts/test_api.py`.

> **Restart uvicorn after backend changes** — a stale process can serve old routes, the corporativo glossary, or old NL→SQL prompts.

> **Exposing via a tunnel?** Add the tunnel host to `server.allowedHosts` in [frontend/vite.config.ts](frontend/vite.config.ts), otherwise Vite blocks the request.

---

## Demo users

| Username | Password | Role | Scope |
|---|---|---|---|
| `admin` | `aersa2026` | `corporativo` | All companies + adoption panel |
| `auditor_956` | `talos2026` | `auditor` | Empresa 956 only |
| `auditor_1024` | `talos2026` | `auditor` | Empresa 1024 only (demo seed) |

Default demo scenario: **empresa 956, periodo 2025-12**.

**Manual smoke (corporativo):** `admin` / `aersa2026` → Panel de Adopción → click an MCP bar / auditor row (drawer analytics) → Datos Raw → CARGAR DATOS → ask an NL question → **VER EN DATOS RAW** → filtered table + banner.

**Manual smoke (auditor):** `auditor_956` / `talos2026` → load 956 / 2025-12 → click a briefing action / hallazgo (drawer with `finding_context`) → tab **Generador de Reporte** → export PDF.

---

## Smoke tests

All scripts default to `empresa=956 periodo=2025-12`; override with positional args, e.g. `... test_engine 956 2025-11`.

```bash
cd backend
uv sync                                      # always first

# Offline / no-API checks
uv run python -m scripts.test_engine         # analytical engine (~5s)
uv run python -m scripts.test_mcp_tools      # 5 MCP tools (~5s cold)
uv run python -m scripts.test_agent          # Ollama tool-calling loop (~19–35s; needs Ollama)

# With the API running
uv run python -m scripts.test_api            # end-to-end (~30s)
uv run python -m scripts.test_auth           # JWT + role scoping
uv run python -m scripts.test_briefing       # guided briefing
uv run python -m scripts.test_analytics      # corporativo analytics

# Frontend
cd ../frontend && npm run typecheck && npm run build
```

---

## API reference

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/login` | public |
| `GET` | `/api/auth/me` | any role |
| `GET` | `/api/companies` | any role |
| `GET` | `/api/periods/{empresa}` | any role |
| `GET` | `/api/cierre/{empresa}/{periodo}` | any role (empresa-scoped for auditor) |
| `POST` | `/api/chat` *(SSE)* | any role — optional `finding_context` on hallazgo clicks |
| `POST` | `/api/chat/corporativo` *(SSE)* | `corporativo` — analytics JSON in prompt, no MCP |
| `PATCH` | `/api/findings/{id}/status` | `auditor` |
| `GET` | `/api/analytics/dashboard` · `/overview` · `/sessions` · `/sessions/{id}` · `/usage-summary` · `/auditor/{user_id}` | `corporativo` |
| `GET` | `/api/raw/cierre` | `corporativo` — enriched rows (`?idempresa&periodo&tabla&limit&offset`) |
| `POST` | `/api/query/nl2sql` *(SSE)* | `corporativo` — NL→SQL on Datos Raw (SELECT-only, `LIMIT`-capped) |
| `GET` | `/api/report/{empresa}/{periodo}` | any role — report bundle for the report generator |

---

## MCP tools

The auditor agent reasons by calling these (read-only, TTL-cached). It never issues raw SQL.

| Tool | Called when the auditor… |
|---|---|
| `get_cierre_summary(idempresa, periodo)` | asks for an overview / totals |
| `get_top_anomalies(idempresa, periodo, n=10)` | asks what needs attention |
| `get_product_history(idproducto, idalmacen, last_n_periods=12)` | asks about a specific product's trend |
| `get_category_shrinkage(idempresa, periodo, idcategoria=None)` | asks for a category breakdown |
| `generate_audit_brief(idempresa, periodo)` | triggers the guided *"¿Por dónde empiezo?"* briefing |

All tools return `{"error": "<type>", "message": "..."}` on failure — they never raise.

---

## Analytical engine — key formulas

```python
# Shrinkage rate (positive = loss). NOTE: merma_rate is a ratio — 1.0 == 100% loss.
merma_rate = -diferencia / stock_teorico

# Z-score anomaly vs. 12-period baseline per (producto × almacen)
z_score = (current_merma_rate - mean_merma_rate) / std_merma_rate
#   z > 2.0 → soft flag · z > 3.0 → hard anomaly
#   std ≈ 0 fallback → IQR outlier check (q75 + 1.5 × IQR)

# Financial impact
financial_impact_mxn = abs(diferencia) * costo_promedio

# Priority score (0–100)
severity   = min(z_score / 5.0, 1.0)
impact     = financial_impact_mxn / max_impact_in_cierre
recurrence = min(recurrence_count / 4.0, 1.0)
priority_score = min(round((0.40*severity + 0.40*impact + 0.20*recurrence) * category_weight * 100, 1), 100)
#   >= 75 CRÍTICO · >= 50 ALTO · >= 25 MEDIO · < 25 BAJO
#   category weights: Alimentos 1.0 · Bebidas 1.2 · Gastos 0.8

# Weighted ranking (UI sort key)
# score_ponderado = 0.40·z + 0.25·priority + 0.15·rec + 0.12·mxn + 0.08·merma  (each normalized)
```

> **Data-quality guard (applied unconditionally):** one corrupt row (`idinventariomesdetalle = 90806848`) inflates totals to trillions of MXN. It and the outlier thresholds are baked into the `inventariomesdetalle_clean` view — always query the clean view, never the raw table.

---

## Domain glossary

| Term | Meaning |
|---|---|
| **Cierre de Semana** | Weekly inventory close / reconciliation |
| **Merma** | Shrinkage — inventory loss (physical vs. theoretical) |
| **Empresa / `idempresa`** | Restaurant company identifier |
| **Periodo** | Period string, e.g. `2025-12` |
| **Almacén** | Warehouse / storage area |
| **Requisición** | Internal transfer between warehouses |
| **`_diferencia`** | `_stockfisico − _stockteorico` (negative = shrinkage) |
| **`_difimporte`** | `_diferencia × _costopromedio` (MXN impact) |

---

## Conventions & gotchas

- **`uv` only** — never `pip install`. Run everything as `uv run python -m <module>`.
- **MCP path is `backend/mcp_server/`**, not `backend/mcp/` (avoids shadowing the SDK).
- **TALOS MariaDB is read-only.** All writes go to `analytics.db`.
- **Always use the `inventariomesdetalle_clean` view** — never the raw table.
- **Hallazgo clicks must send `finding_context`** so the agent answers without re-asking for IDs/period.
- **Corporativo prompt templates:** avoid bare `{word}` in strings passed to `.format()` (use `{{`/`}}` or rephrase).
- **NL→SQL:** corporativo-only, SELECT-only, single-statement, hard-capped at `MAX_ROWS = 500` (a `LIMIT` is appended if the model omits one; over-cap results are flagged `truncated`). The SQL→Raw cross-filter needs recognizable columns (`producto_nombre`, `idproducto`, …); matched rows are sorted by MXN impact, and a recognized-but-zero-match filter falls back to the full cierre.
- **A new `audit_session_id` is created on every `GET /api/cierre`** — intentional.

---

## Project status

**Phase 2** (production-grade features). Phase 1 prototype (DB/engine/MCP/agent/API/UI) is complete; Phase 2 adds JWT auth, interaction logging, guided briefing, finding status, owner analytics, the corporativo panel, the report generator, and the NL→SQL / Datos Raw bridge.

**Next:** Docker compose + production hardening.

Full history, decisions, and per-session notes live in the knowledge vault under
`wiki/projects/ongoing/aersa-copilot/` (`status.md`, `architecture.md`, `decisions/`, `entities/`, `sessions/`).
The in-repo runtime cheat sheet is [CLAUDE.md](CLAUDE.md).

---

*Built for AERSA · Tec de Monterrey (MA3001B). Inventory data is confidential to AERSA and not included in this repository.*
