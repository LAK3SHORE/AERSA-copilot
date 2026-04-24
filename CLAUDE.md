# AERSA Copilot — Claude Code Master Plan
> TALOS Analytical Audit Copilot · MA3001B · Tec de Monterrey × AERSA
> Last updated: April 2026
>
> **v0.0 pivots (locked in 2026-04-24):**
> - LLM provider: **Ollama (local) running `gemma4:e4b`**, not Anthropic Claude.
> - Python tooling: **`uv`** for venv + dependency management, not pip/requirements.txt.
> - Python interpreter: **3.12** (uv-resolved from `>=3.11,<3.14`).
> - No Anthropic API key required; the system runs fully on-device for the LLM layer.
>
> **Build status (last updated 2026-04-24):**
> - Session 1 (DB + cleaning layer) ✅ — views applied, invariants pass.
> - Sessions 2–8 ⏳ — pending.

---

## 0. How to use this document

This is the north-star reference for every Claude Code session on this project.
Read it fully before writing any code. Every architectural decision made here has a reason;
do not deviate without updating this document first.

When starting a new session, tell Claude Code:
> "Read CLAUDE.md fully before doing anything. Follow all conventions and architectural decisions defined there."

---

## 1. Problem statement

### 1.1 Business context

AERSA (Asesoría Enfocada a Resultados) is a consulting and technology firm for the
restaurant industry in Mexico. Their platform, TALOS, centralizes operational, administrative,
and financial data for multi-branch food and beverage businesses.

TALOS's most critical process is the **Cierre de Semana** (Weekly Close): the reconciliation
of initial inventory, purchases, internal transfers (requisitions), sales, and final physical
counts for each warehouse and branch during a given period.

Currently, interpreting the Cierre de Semana depends entirely on an experienced auditor who
manually reads tabular data and applies intuition developed over years. There is no automated
alerting, no anomaly detection, and no prioritization. An auditor reviews hundreds of line
items per inventory and must identify what actually matters.

### 1.2 The core problem

> The gap between data that exists and insight that is actionable is filled entirely by human experience.

Specific failure modes this causes:
- Critical shrinkage events (merma) go unnoticed until they compound over weeks
- An auditor reviewing 100+ branches cannot apply the same attention to each
- No quantitative baseline exists — "this looks wrong" is not reproducible
- Knowledge is not transferable — junior auditors miss what veterans catch
- No cross-branch comparison: a product with normal shrinkage at 8/10 branches
  but anomalous shrinkage at 2/10 is invisible to per-branch manual review

### 1.3 The opportunity

TALOS contains 11.7 million inventory detail rows spanning Oct 2016 to Apr 2026.
This is a rich, longitudinal signal. The historical data encodes what "normal" looks like
for each product, warehouse, branch, and company. Anomalies can be detected statistically.
Findings can be ranked by financial impact. Natural language makes the output accessible
to non-technical auditors.

---

## 2. Final product vision

A **domain-specific analytical copilot** for TALOS auditors, consisting of:

### 2.1 Analytical engine (the brain)
A Python pipeline that runs on top of the TALOS MariaDB database and produces
pre-computed, structured audit findings for any given Cierre de Semana.
This is NOT a generic SQL chatbot. The engine encodes auditing domain logic:
what counts as anomalous shrinkage, how to rank findings by impact, how to compare
across historical baselines.

### 2.2 MCP server (the API)
A custom Model Context Protocol server that exposes domain-specific tools.
The LLM never queries the raw database directly. It calls MCP tools that return
clean, pre-processed, business-contextualized data.

### 2.3 LLM copilot (the communicator)
A Claude-backed agent that uses the MCP tools to answer auditor questions in natural
language. It understands TALOS vocabulary, knows what a Cierre de Semana is, knows
the difference between merma real vs. teórica, and can generate audit narratives.

### 2.4 Web interface (the face)
A React + FastAPI web app where auditors select a company and period, see an
auto-generated findings summary, and can drill into specific findings via chat.

---

## 3. Database context

### 3.1 Connection

```
Engine:   MariaDB 10.4.28
Host:     127.0.0.1
Port:     3306
User:     root
Password: (none)
Database: talos_tecmty
Charset:  utf8mb4 / utf8mb4_unicode_ci
```

### 3.2 Key tables and their roles

| Table | Rows | Role in the copilot |
|---|---|---|
| `unidadmedida` | 9 | Unit labels for display |
| `categoria` | 315 | Hierarchical category tree (Alimentos / Bebidas / Gastos) |
| `almacen` | 18,387 | Warehouses per branch |
| `productotalos` | 1,753 | Normalized master product catalog |
| `producto` | 302,325 | Company-level product instances |
| `inventariomes` | 79,445 | Monthly inventory header per warehouse |
| `inventariomesdetalle` | 11,772,750 | Line-level inventory detail — core signal |

### 3.3 Critical field mappings

**`inventariomesdetalle`** — the most important table:
- `_stockinicial` — stock at start of period
- `_stockteorico` — expected stock after all movements (purchases + transfers - sales)
- `_stockfisico` — actual physical count
- `_diferencia` = `_stockfisico - _stockteorico` (negative = shrinkage/merma)
- `_ingresocompra` — units purchased
- `_egresoventa` — units sold
- `_ingresorequisicion` / `_egresorequisicion` — internal transfers in/out
- `_reajuste` — manual adjustment
- `_costopromedio` — average cost per unit (MXN)
- `_importefisico` = `_stockfisico * _costopromedio` — physical stock value (MXN)
- `_difimporte` = `_diferencia * _costopromedio` — financial impact of discrepancy

**`inventariomes`** — inventory header:
- `idinventariomes` — PK, links to all detail rows
- `idalmacen` — FK to warehouse
- `idempresa` — company identifier (external FK, no parent table in backup)
- `idsucursal` — branch identifier (external FK)
- `_fecha` — inventory date (this is the Cierre de Semana anchor)
- `_estatus` — enum: generando / finalizado / editando / aplicado / terminado
- `_finalalimentos`, `_finalbebidas`, `_finalmiscelaneos` — category totals (MXN)
- `_faltantes`, `_sobrantes` — aggregate shortages / overages (MXN)

### 3.4 Known data quality issues — handle these always

**CRITICAL — corrupt row:**
`idinventariomesdetalle = 90806848` has `_stockfisico = 11,111,111,111`.
This single row inflates 2025 totals to trillions of MXN. Filter it unconditionally.

**Outlier thresholds (apply as base filters everywhere):**
```sql
inventariomesdetalle._stockfisico  < 1e7
inventariomesdetalle._importefisico < 1e8
```

**Additional known outliers to investigate:**
- `id = 266474`: stock 108,000, importe 48.6M
- `id = 47764310`: stock 41,800, importe 34.9M

**Null fields to handle:**
- `producto_precio` — 11,243 nulls (use 0 or skip in price-based calcs)
- `producto_ultimocosto` — 56,068 nulls (fall back to `producto_costo`)
- `idcategoria` — 2,398 nulls in producto (assign to "Sin categoría")

**Product linkage:**
Only 8.2% of `producto` rows have `idproductotalos`. When it exists, use it for
cross-company product normalization. For the remaining 91.8%, use
`producto_nombre + idcategoria` as a soft identity.

---

## 4. Full architecture

### 4.1 Layer diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4 — INTERFACE                                            │
│  React (Vite + TypeScript)  +  FastAPI (WebSocket for chat)     │
│  ┌──────────────────────┐   ┌──────────────────────────────┐   │
│  │  Cierre selector     │   │  Chat panel (streaming SSE)  │   │
│  │  KPI summary cards   │   │  Anomaly cards w/ severity   │   │
│  └──────────────────────┘   └──────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────────────────┐
│  LAYER 3 — LLM + MCP                                            │
│  FastAPI app  (main API surface)                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  LLM Agent (Ollama · gemma4:e4b, local)                  │   │
│  │  Tool-calling loop via Ollama Python SDK (native tools)  │   │
│  │  System prompt: TALOS business context injected here     │   │
│  └───────────────────┬──────────────────────────────────────┘   │
│                      │ MCP tool calls                            │
│  ┌───────────────────▼──────────────────────────────────────┐   │
│  │  MCP Server (FastMCP / mcp Python SDK)                   │   │
│  │  get_cierre_summary · get_top_anomalies                  │   │
│  │  get_product_history · get_category_shrinkage            │   │
│  │  search_products                                         │   │
│  └───────────────────┬──────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ SQL (read-only)
┌───────────────────────▼─────────────────────────────────────────┐
│  LAYER 2 — ANALYTICAL ENGINE                                     │
│  Python (SQLAlchemy + pandas + scipy + scikit-learn)             │
│  ┌──────────────┐ ┌───────────────────┐ ┌─────────────────────┐ │
│  │ Cleaning     │ │ Anomaly detection │ │ Alert scoring       │ │
│  │ views +      │ │ Z-score per       │ │ Composite priority  │ │
│  │ outlier      │ │ (product, almacen)│ │ = impact × severity │ │
│  │ filters      │ │ + IQR flagging    │ │ × recurrence        │ │
│  └──────────────┘ └───────────────────┘ └─────────────────────┘ │
└───────────────────────┬─────────────────────────────────────────┘
                        │ read-only connection
┌───────────────────────▼─────────────────────────────────────────┐
│  LAYER 1 — DATA SOURCE                                           │
│  MariaDB 10.4.28 · talos_tecmty                                  │
│  inventariomesdetalle (11.7M rows) · producto (302K) · etc.      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Request flow (chat query)

```
Auditor types question
    → Frontend sends POST /api/chat {empresa, periodo, message, history}
    → FastAPI LLM agent receives request
    → Agent builds messages array with system prompt + conversation history
    → Agent calls Ollama (gemma4:e4b) with tools registered
    → Gemma decides which MCP tool(s) to call
    → MCP tool executes SQL query via analytical engine
    → Returns structured JSON result to Gemma
    → Gemma synthesizes natural language response
    → FastAPI streams response tokens via SSE back to frontend
    → Frontend renders streamed response in chat panel
```

### 4.3 Request flow (initial Cierre load)

```
Auditor selects empresa + periodo
    → Frontend sends GET /api/cierre/{idempresa}/{periodo}
    → FastAPI calls analytical engine directly (no LLM needed)
    → Engine runs: clean view → anomaly scoring → priority ranking
    → Returns CierreReport JSON: kpis + top_anomalies list
    → Frontend renders KPI cards + anomaly list
    → Chat panel pre-loaded with context: "Cierre de [periodo] cargado para empresa [id]"
```

---

## 5. Project structure

```
aersa-copilot/
├── CLAUDE.md                          ← this file
├── docker-compose.yml                 ← orchestrates all services
├── .env.example                       ← required env vars (copy to .env)
│
├── backend/
│   ├── pyproject.toml                 ← uv-managed deps + project metadata
│   ├── uv.lock                        ← uv lockfile
│   ├── README.md                      ← backend setup + run instructions
│   ├── main.py                        ← FastAPI app entry point
│   ├── config.py                      ← env vars, DB URL, Ollama host/model
│   │
│   ├── scripts/
│   │   └── bootstrap_views.py         ← apply views.sql + validate invariants
│   │
│   ├── db/
│   │   ├── connection.py              ← SQLAlchemy engine + session factory
│   │   ├── views.sql                  ← SQL view definitions (run once at startup)
│   │   └── queries/
│   │       ├── cierre.py              ← Cierre de Semana summary queries
│   │       ├── anomalies.py           ← anomaly detection queries
│   │       ├── products.py            ← product + category lookup queries
│   │       └── history.py             ← historical trend queries
│   │
│   ├── engine/
│   │   ├── cleaning.py                ← outlier filter logic, clean view builder
│   │   ├── anomaly.py                 ← z-score + IQR anomaly detection
│   │   ├── scoring.py                 ← composite alert priority scoring
│   │   └── report.py                  ← assembles CierreReport from engine outputs
│   │
│   ├── mcp/
│   │   ├── server.py                  ← MCP server definition (FastMCP)
│   │   └── tools/
│   │       ├── cierre_summary.py      ← get_cierre_summary tool
│   │       ├── top_anomalies.py       ← get_top_anomalies tool
│   │       ├── product_history.py     ← get_product_history tool
│   │       ├── category_shrinkage.py  ← get_category_shrinkage tool
│   │       └── search_products.py     ← search_products tool
│   │
│   ├── llm/
│   │   ├── agent.py                   ← Claude tool-calling agent loop
│   │   ├── prompts.py                 ← system prompt + context injection
│   │   └── streaming.py               ← SSE streaming handler
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── cierre.py              ← GET /api/cierre/{empresa}/{periodo}
│   │   │   ├── chat.py                ← POST /api/chat (SSE stream)
│   │   │   ├── companies.py           ← GET /api/companies (selector)
│   │   │   └── periods.py             ← GET /api/periods/{empresa}
│   │   └── models.py                  ← Pydantic request/response models
│   │
│   └── tests/
│       ├── test_engine.py
│       ├── test_mcp_tools.py
│       └── test_agent.py
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   ├── cierre.ts              ← API client for /api/cierre
        │   └── chat.ts                ← SSE client for /api/chat
        ├── components/
        │   ├── Selector/
        │   │   ├── CompanySelect.tsx
        │   │   └── PeriodSelect.tsx
        │   ├── Dashboard/
        │   │   ├── KPICards.tsx
        │   │   └── AnomalyList.tsx
        │   └── Chat/
        │       ├── ChatPanel.tsx
        │       ├── MessageBubble.tsx
        │       └── ChatInput.tsx
        ├── types/
        │   └── index.ts               ← shared TypeScript types
        └── styles/
            └── global.css
```

---

## 6. Analytical engine — detailed spec

### 6.1 SQL views (run at backend startup)

```sql
-- inventariomesdetalle_clean
-- Base filtered view. ALWAYS use this, never raw inventariomesdetalle.
CREATE OR REPLACE VIEW inventariomesdetalle_clean AS
SELECT *
FROM inventariomesdetalle
WHERE idinventariomesdetalle != 90806848          -- known corrupt row
  AND inventariomesdetalle_stockfisico  < 1e7
  AND inventariomesdetalle_importefisico < 1e8
  AND inventariomesdetalle_stockfisico  >= 0;

-- inventario_full
-- Joins detail with header + warehouse for common analysis queries.
CREATE OR REPLACE VIEW inventario_full AS
SELECT
    d.idinventariomesdetalle,
    d.idinventariomes,
    d.idproducto,
    m.idalmacen,
    m.idempresa,
    m.idsucursal,
    m.inventariomes_fecha                      AS fecha,
    DATE_FORMAT(m.inventariomes_fecha, '%Y-%m') AS periodo,
    d.inventariomesdetalle_stockinicial        AS stock_inicial,
    d.inventariomesdetalle_stockteorico        AS stock_teorico,
    d.inventariomesdetalle_stockfisico         AS stock_fisico,
    d.inventariomesdetalle_diferencia          AS diferencia,
    d.inventariomesdetalle_ingresocompra       AS ingreso_compra,
    d.inventariomesdetalle_egresoventa         AS egreso_venta,
    d.inventariomesdetalle_ingresorequisicion  AS ingreso_req,
    d.inventariomesdetalle_egresorequisicion   AS egreso_req,
    d.inventariomesdetalle_reajuste            AS reajuste,
    d.inventariomesdetalle_costopromedio       AS costo_promedio,
    d.inventariomesdetalle_importefisico       AS importe_fisico,
    d.inventariomesdetalle_difimporte          AS dif_importe,
    m.inventariomes_estatus                    AS estatus
FROM inventariomesdetalle_clean d
JOIN inventariomes m ON d.idinventariomes = m.idinventariomes
WHERE m.inventariomes_estatus IN ('finalizado','aplicado','terminado');
```

### 6.2 Anomaly detection logic (`engine/anomaly.py`)

The core of the analytical engine. For each line in a Cierre de Semana, compute:

**Shrinkage rate:**
```
merma_rate = -diferencia / stock_teorico   (when stock_teorico > 0)
```
A positive value means physical stock is below theoretical — product is missing.
Values > 0 are losses. Values < 0 are overages (physical > theoretical).

**Historical baseline per (idproducto, idalmacen):**
Query the last 12 periods of `inventario_full` for this product × warehouse combination.
Compute rolling statistics: `mean_merma_rate`, `std_merma_rate`, `q25`, `q75`, `iqr`.
Require minimum 3 historical periods for a valid baseline; if fewer, flag as "insufficient history".

**Z-score anomaly:**
```
z_score = (current_merma_rate - mean_merma_rate) / std_merma_rate
```
A z_score > 2.0 is a soft flag. A z_score > 3.0 is a hard anomaly.

**IQR anomaly (fallback when std is near 0):**
```
iqr_bound = q75 + 1.5 * iqr
is_iqr_outlier = current_merma_rate > iqr_bound
```

**Financial impact:**
```
financial_impact_mxn = abs(diferencia) * costo_promedio
```
This converts unit discrepancies into MXN value.

### 6.3 Priority scoring (`engine/scoring.py`)

Each anomalous line item receives a composite priority score (0–100):

```python
def compute_priority_score(
    z_score: float,
    financial_impact_mxn: float,
    recurrence_count: int,          # how many of last 4 periods also had z > 2
    category_weight: float,         # 1.0 for Alimentos, 1.2 for Bebidas, 0.8 for Gastos
    max_impact_in_cierre: float,    # normalization denominator
) -> float:
    severity_score  = min(z_score / 5.0, 1.0)             # capped at 1.0
    impact_score    = financial_impact_mxn / max_impact_in_cierre
    recurrence_score = min(recurrence_count / 4.0, 1.0)

    raw = (
        0.40 * severity_score +
        0.40 * impact_score +
        0.20 * recurrence_score
    ) * category_weight

    return round(min(raw * 100, 100), 1)
```

Severity label mapping:
- score >= 75: `CRÍTICO` (red)
- score >= 50: `ALTO` (orange)
- score >= 25: `MEDIO` (yellow)
- score < 25:  `BAJO` (gray)

### 6.4 CierreReport schema (`engine/report.py`)

The `CierreReport` is the central data structure passed between the analytical engine,
the MCP tools, and the LLM. It is computed once per (empresa, periodo) request and
cached in memory for the duration of a session.

```python
@dataclass
class KPISummary:
    idempresa: int
    periodo: str                   # "YYYY-MM"
    num_almacenes: int
    num_productos: int
    total_importe_fisico_mxn: float
    total_faltantes_mxn: float
    total_sobrantes_mxn: float
    total_compras_unidades: float
    total_ventas_unidades: float
    top_categoria_faltante: str    # e.g. "Bebidas > Tequila"
    pct_lineas_con_merma: float    # % of lines where diferencia < 0

@dataclass
class AnomalyRecord:
    idinventariomesdetalle: int
    idproducto: int
    producto_nombre: str
    idcategoria: int
    categoria_nombre: str
    subcategoria_nombre: str
    idalmacen: int
    almacen_nombre: str
    idsucursal: int
    periodo: str
    merma_rate: float              # ratio: loss / teorico
    z_score: float
    financial_impact_mxn: float
    priority_score: float
    severity_label: str            # CRÍTICO / ALTO / MEDIO / BAJO
    mean_merma_rate_hist: float    # historical baseline
    recurrence_count: int
    unidad_medida: str

@dataclass
class CierreReport:
    idempresa: int
    periodo: str
    generated_at: str              # ISO timestamp
    kpis: KPISummary
    top_anomalies: list[AnomalyRecord]   # top 20 by priority_score
    total_anomalies_found: int
    data_quality_warnings: list[str]     # e.g. "X rows filtered as outliers"
```

---

## 7. MCP server — detailed spec

### 7.1 Server setup (`mcp/server.py`)

Use the `mcp` Python SDK (FastMCP). The server runs as a subprocess managed by the
FastAPI backend, communicating via stdio or as a module imported directly.
For the prototype, import directly and call tools as functions — no subprocess needed.

### 7.2 Tool contracts

All tools accept `idempresa: int` and `periodo: str` ("YYYY-MM") as minimum arguments.
All tools return typed Python dataclasses serialized to JSON.

---

**Tool 1: `get_cierre_summary`**

```python
@mcp.tool()
def get_cierre_summary(idempresa: int, periodo: str) -> dict:
    """
    Returns the top-level KPI summary for a Cierre de Semana.
    Use this when the auditor asks for an overview, totals, or general status
    of a given period. Returns financial totals, shrinkage summary,
    number of warehouses and products, and top problem category.
    """
```

Returns: `KPISummary` serialized as dict.
SQL anchor: `inventariomes` headers + `inventariomesdetalle_clean` aggregated.

---

**Tool 2: `get_top_anomalies`**

```python
@mcp.tool()
def get_top_anomalies(idempresa: int, periodo: str, n: int = 10) -> dict:
    """
    Returns the top N anomalous inventory lines for a Cierre de Semana,
    ranked by composite priority score (financial impact × statistical deviation
    × recurrence). Use this when the auditor asks what needs attention,
    what the biggest problems are, or wants a prioritized review list.
    """
```

Returns: `list[AnomalyRecord]` (top n), serialized as dict.

---

**Tool 3: `get_product_history`**

```python
@mcp.tool()
def get_product_history(
    idproducto: int,
    idalmacen: int,
    last_n_periods: int = 12
) -> dict:
    """
    Returns the historical merma rate and financial impact for a specific
    product in a specific warehouse over the last N months. Use this when
    the auditor asks about the trend of a specific product, whether the
    current anomaly is new or recurring, or wants to see the historical
    baseline for a finding.
    """
```

Returns: list of `{periodo, merma_rate, financial_impact_mxn, z_score}` dicts,
ordered chronologically.

---

**Tool 4: `get_category_shrinkage`**

```python
@mcp.tool()
def get_category_shrinkage(
    idempresa: int,
    periodo: str,
    idcategoria: int | None = None
) -> dict:
    """
    Returns shrinkage breakdown aggregated by category and subcategory
    for a given Cierre. If idcategoria is provided, drills into that
    category's subcategories. Use this when the auditor asks about a
    specific category, wants to compare Alimentos vs Bebidas, or needs
    to understand where shrinkage is concentrated.
    """
```

Returns: list of `{categoria, subcategoria, total_merma_mxn, pct_del_total, num_productos}`.

---

**Tool 5: `search_products`**

```python
@mcp.tool()
def search_products(
    idempresa: int,
    query: str,
    limit: int = 10
) -> dict:
    """
    Searches for products by name within a company's catalog.
    Use this when the auditor mentions a product by name and you need
    to resolve it to an idproducto before calling other tools.
    Returns matching products with their ids, categories, and unit of measure.
    """
```

Returns: list of `{idproducto, nombre, categoria, subcategoria, unidad_medida, tipo}`.

---

### 7.3 Error handling in tools

Every tool must handle:
- `idempresa` not found → return `{"error": "empresa_not_found", "message": "..."}`
- `periodo` with no data → return `{"error": "no_data", "message": "No hay inventarios finalizados para este periodo."}`
- DB connection failure → log and return `{"error": "db_error", "message": "..."}`
- Insufficient historical data for anomaly → return results with `data_quality_warnings` populated

---

## 8. LLM agent — detailed spec

### 8.1 System prompt (`llm/prompts.py`)

The system prompt is the single most important piece of the LLM layer.
It must be injected at the start of every conversation.

```python
SYSTEM_PROMPT = """
Eres el Copiloto Analítico de TALOS, un asistente especializado en auditoría
operativa de inventarios para restaurantes y negocios de alimentos y bebidas.

Trabajas con datos del sistema TALOS de AERSA. Tu rol es ayudar a auditores
a interpretar el Cierre de Semana: identificar hallazgos relevantes, explicar
anomalías estadísticas en términos de negocio, y priorizar qué revisar primero.

## Vocabulario TALOS que debes dominar

- **Cierre de Semana**: reconciliación periódica de inventario. Integra stock
  inicial, compras, requisiciones (transferencias inter-almacén), ventas y
  conteo físico final.
- **Stock teórico**: lo que *debería* haber según los movimientos registrados.
- **Stock físico**: lo que el auditor contó físicamente.
- **Diferencia / Merma**: stock_fisico - stock_teorico. Negativa = faltante.
- **Merma real**: diferencia que implica pérdida económica real (robo, desperdicio,
  error de receta, producción no registrada).
- **Merma teórica**: diferencia explicable por tolerancias del proceso.
- **Requisición**: movimiento de inventario entre almacenes de la misma empresa.
  No es pérdida; es transferencia interna.
- **Almacén general / Cocina / Barra**: tipos de almacén. Cada sucursal tiene varios.
- **PLU**: producto de venta al público (precio > costo). Tipo: plu.
- **Subreceta**: preparación intermedia. Su merma puede indicar problemas de producción.
- **CRÍTICO / ALTO / MEDIO / BAJO**: niveles de severidad de los hallazgos.

## Cómo usar tus herramientas

Siempre que el auditor pregunte sobre datos específicos, usa las herramientas
disponibles. NO inventes números. Si no tienes datos para responder, dilo
claramente y usa search_products o get_cierre_summary para obtenerlos.

Flujo recomendado:
1. Si la pregunta es general sobre el Cierre → usa get_cierre_summary
2. Si pregunta qué revisar / qué está mal → usa get_top_anomalies
3. Si menciona un producto específico → usa search_products primero para
   resolver el nombre a un idproducto, luego get_product_history
4. Si pregunta sobre una categoría → usa get_category_shrinkage

## Contexto actual (se inyecta dinámicamente)
Empresa: {idempresa}
Periodo: {periodo}
Almacenes activos en este Cierre: {num_almacenes}

## Formato de respuestas

- Usa lenguaje claro y directo, apropiado para un auditor operativo.
- Cuando reportes hallazgos, estructura: Qué pasó → Magnitud → Impacto financiero → Recomendación.
- Usa el símbolo $ MXN para valores monetarios.
- Para merma, reporta siempre el porcentaje Y el valor absoluto en MXN.
- Si un hallazgo es CRÍTICO, dilo explícitamente al inicio de tu respuesta.
- No uses markdown excesivo. Respuestas concisas y accionables.
- Responde siempre en español.
"""
```

### 8.2 Agent loop (`llm/agent.py`)

```python
async def run_agent(
    idempresa: int,
    periodo: str,
    messages: list[dict],          # conversation history
    stream_callback: Callable      # SSE callback for token streaming
) -> str:
    """
    Tool-calling agent loop using the Ollama Python SDK against a local
    gemma4:e4b model. Supports multi-turn tool use (tools → results → more
    tools → final response). Max 5 tool-call rounds to prevent infinite loops.
    """
    client = ollama.AsyncClient(host=settings.OLLAMA_HOST)

    system = build_system_prompt(idempresa, periodo)
    tools = get_mcp_tool_definitions()  # list of OpenAI-style tool schemas

    current_messages = [{"role": "system", "content": system}, *messages]
    max_rounds = 5

    for round_num in range(max_rounds):
        # Ollama streams chunks; we collect text tokens and any tool_calls
        stream = await client.chat(
            model=settings.OLLAMA_MODEL,        # "gemma4:e4b"
            messages=current_messages,
            tools=tools,
            stream=True,
            options={"temperature": 0.2, "num_ctx": 8192},
        )

        assistant_message, tool_calls = await collect_streamed_response(
            stream, stream_callback
        )

        current_messages.append({
            "role": "assistant",
            "content": assistant_message,
            **({"tool_calls": tool_calls} if tool_calls else {}),
        })

        if not tool_calls:
            break

        # Execute tool calls in order; append each result as a tool message
        for tool_call in tool_calls:
            result = await execute_mcp_tool(
                tool_call["function"]["name"],
                tool_call["function"]["arguments"],
                idempresa,
                periodo,
            )
            current_messages.append({
                "role": "tool",
                "name": tool_call["function"]["name"],
                "content": json.dumps(result, ensure_ascii=False),
            })

    return extract_final_text(current_messages[-1])
```

### 8.3 Tool definitions for Gemma

Tool definitions follow Ollama's OpenAI-compatible function-calling schema and
must match the MCP tool contracts exactly. Build them programmatically from
the MCP server tool registry to avoid drift. Because `gemma4:e4b` is a local
8B model with native `tools` capability, prompt guardrails (strict argument
descriptions, `idempresa`/`periodo` always required) matter more than they
would with a frontier model — invest in the JSON schemas.

---

## 9. API routes — detailed spec

### 9.1 `GET /api/companies`

Returns list of companies with data in the database, ordered by inventory count.
For the prototype, hardcode to top 5: `[956, 6, 193, 675, 187]` with display names.

Response:
```json
[
  {"idempresa": 956, "nombre": "Empresa 956", "num_inventarios": 10871},
  {"idempresa": 6,   "nombre": "Empresa 6",   "num_inventarios": 10243},
  ...
]
```

### 9.2 `GET /api/periods/{idempresa}`

Returns list of available periods for a company (YYYY-MM), ordered descending.
Filter to periods with at least one `finalizado` or `aplicado` inventory.

Response:
```json
["2026-03", "2026-02", "2026-01", "2025-12", ...]
```

### 9.3 `GET /api/cierre/{idempresa}/{periodo}`

Triggers the analytical engine for this company × period.
Returns `CierreReport` as JSON.
Cache result in memory for 10 minutes (same empresa + periodo = same result).

Response: `CierreReport` JSON (see schema in section 6.4).

### 9.4 `POST /api/chat` (SSE streaming)

```json
// Request body
{
  "idempresa": 956,
  "periodo": "2025-12",
  "message": "¿Cuáles son los hallazgos más críticos esta semana?",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

Response: Server-Sent Events stream.
```
data: {"type": "token", "content": "Los hallazgos"}
data: {"type": "token", "content": " más críticos son"}
data: {"type": "tool_call", "name": "get_top_anomalies", "status": "running"}
data: {"type": "tool_result", "name": "get_top_anomalies", "status": "done"}
data: {"type": "token", "content": "..."}
data: {"type": "done"}
```

---

## 10. Frontend — detailed spec

### 10.1 Tech stack

- **Vite + React + TypeScript**
- **Tailwind CSS** for styling (dark theme preferred, consistent with TALOS B2B context)
- **ShadCN UI** for components (cards, select, badge, scroll area)
- **EventSource API** for SSE chat streaming
- **Recharts** for the product history trend chart in the chat

### 10.2 Page layout

```
┌─────────────────────────────────────────────────────┐
│  HEADER: TALOS Copiloto · AERSA logo                │
├────────────────────┬────────────────────────────────┤
│  LEFT PANEL        │  RIGHT PANEL                   │
│  (40% width)       │  (60% width)                   │
│                    │                                 │
│  [Empresa Select]  │  Chat panel                    │
│  [Periodo Select]  │                                 │
│  [Cargar Cierre]   │  ┌─────────────────────────┐   │
│                    │  │ Message bubbles          │   │
│  ─── KPIs ───      │  │ (user right, AI left)    │   │
│  Total importe     │  │                          │   │
│  Total faltantes   │  │ Tool call indicators     │   │
│  % líneas merma    │  │ shown inline             │   │
│  Top categoría     │  └─────────────────────────┘   │
│                    │                                 │
│  ─── Hallazgos ─── │  [Chat input + send button]    │
│  [CRÍTICO badge]   │                                 │
│  Producto name     │                                 │
│  Almacén · Merma%  │                                 │
│  $MXN impact       │                                 │
│  [click to ask AI] │                                 │
│  ...               │                                 │
└────────────────────┴────────────────────────────────┘
```

### 10.3 Key interactions

**Anomaly card click:**
When an auditor clicks an anomaly card on the left panel, the chat panel on the right
automatically sends a pre-built message:
```
"Explícame el hallazgo de [producto_nombre] en [almacen_nombre].
¿Por qué es anómalo y qué debería revisar?"
```
This bridges the dashboard to the conversational interface seamlessly.

**Cierre load state:**
Show a loading skeleton while `GET /api/cierre` runs (can take 3–10s for large companies).
Once loaded, show a toast: "Cierre de [periodo] cargado — [N] hallazgos detectados."
Pre-populate chat with a welcome message from the AI summarizing the Cierre.

**Chat tool call indicators:**
When the LLM is calling a tool, show an inline indicator in the chat:
`⚙ Consultando get_top_anomalies...`
This makes the AI feel transparent rather than opaque.

### 10.4 TypeScript types (`types/index.ts`)

```typescript
export interface KPISummary {
  idempresa: number
  periodo: string
  numAlmacenes: number
  numProductos: number
  totalImporteFisicoMxn: number
  totalFaltantesMxn: number
  totalSorantesMxn: number
  totalComprasUnidades: number
  totalVentasUnidades: number
  topCategoriaFaltante: string
  pctLineasConMerma: number
}

export interface AnomalyRecord {
  idinventariomesdetalle: number
  idproducto: number
  productoNombre: string
  idcategoria: number
  categoriaNombre: string
  subcategoriaNombre: string
  idalmacen: number
  almacenNombre: string
  idsucursal: number
  periodo: string
  mermaRate: number
  zScore: number
  financialImpactMxn: number
  priorityScore: number
  severityLabel: 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO'
  meanMermaRateHist: number
  recurrenceCount: number
  unidadMedida: string
}

export interface CierreReport {
  idempresa: number
  periodo: string
  generatedAt: string
  kpis: KPISummary
  topAnomalies: AnomalyRecord[]
  totalAnomaliesFound: number
  dataQualityWarnings: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallIndicator[]
}

export interface ToolCallIndicator {
  name: string
  status: 'running' | 'done' | 'error'
}
```

---

## 11. Environment variables (`.env`)

```bash
# Database
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

# Cache
CIERRE_CACHE_TTL_SECONDS=600

# Anomaly thresholds (can tune without code changes)
ANOMALY_ZSCORE_SOFT=2.0
ANOMALY_ZSCORE_HARD=3.0
ANOMALY_MIN_HISTORY_PERIODS=3
ANOMALY_ROLLING_WINDOW_MONTHS=12
OUTLIER_MAX_STOCK_FISICO=10000000
OUTLIER_MAX_IMPORTE_FISICO=100000000
```

---

## 12. Python dependencies (`backend/pyproject.toml`)

Managed with **`uv`**. Bootstrap with:

```bash
cd backend
uv sync          # creates .venv and installs everything from uv.lock
uv run python -m main    # run the app inside the managed venv
```

Direct dependencies (versions resolved by uv against current PyPI; pins below
are floors — bump to whatever uv resolves on first `uv sync` and commit
`uv.lock`):

```toml
[project]
name = "aersa-copilot-backend"
version = "0.0.1"
requires-python = ">=3.11,<3.14"   # 3.14 lacks wheels for some scientific deps as of 2026-04

dependencies = [
  # Web framework
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
  "python-dotenv>=1.0",

  # Database
  "sqlalchemy>=2.0",
  "pymysql>=1.1",

  # Data processing
  "pandas>=2.2",
  "numpy>=1.26",
  "scipy>=1.14",
  "scikit-learn>=1.5",

  # Local LLM (Ollama)
  "ollama>=0.4",

  # MCP (decorators only; no subprocess in v0)
  "mcp>=1.1",

  # Validation
  "pydantic>=2.9",
  "pydantic-settings>=2.6",

  # SSE streaming
  "sse-starlette>=2.1",

  # Caching
  "cachetools>=5.5",
]

[dependency-groups]
dev = [
  "pytest>=8.0",
  "pytest-asyncio>=0.23",
  "ruff>=0.6",
]
```

---

## 13. First deliverable scope (Prototype v0)

This is what we build for the AERSA pitch. Scope is intentionally minimal —
one end-to-end slice that actually works with real data.

### 13.1 In scope

- [x] DB connection + `inventariomesdetalle_clean` + `inventario_full` views
- [ ] Anomaly detection: z-score per (producto, almacen) over 12-month rolling window
- [ ] Priority scoring: composite score (severity + impact + recurrence)
- [ ] CierreReport assembler: top 20 anomalies + KPI summary
- [ ] MCP server with 4 tools: `get_cierre_summary`, `get_top_anomalies`, `get_product_history`, `get_category_shrinkage`
- [ ] LLM agent: Ollama `gemma4:e4b` (local) with native tool-calling loop + system prompt
- [ ] FastAPI backend: `/api/companies`, `/api/periods/{id}`, `/api/cierre/{id}/{periodo}`, `/api/chat` (SSE)
- [ ] React frontend: company/period selector, KPI cards, anomaly list, chat panel
- [ ] One polished demo scenario: empresa 956, periodo 2025-12 (or most recent complete)

### 13.2 Out of scope (save for v1+)

- Authentication / user management
- Cross-branch benchmarking
- Forecasting / predictive models
- Alerts dashboard (auto-push, not chat-pull)
- Export to PDF / Excel
- Full product search in sidebar
- `search_products` MCP tool (low priority for pitch)
- Multi-company comparison

### 13.3 Demo scenario to prepare

Pick empresa 956, most recent period with `estatus = 'finalizado'`.
Before the pitch:
1. Run the analytical engine manually and verify top 3 anomalies make business sense
2. Prepare 3–5 sample questions that showcase the copilot's capabilities:
   - "¿Qué debo revisar primero en este Cierre?"
   - "Explícame el hallazgo de [top product]"
   - "¿Cómo viene [categoría] comparado con meses anteriores?"
   - "¿Hay algún problema recurrente que debería escalar?"
3. Have fallback screenshots in case live DB is unavailable during pitch

---

## 14. Build order (suggested session sequence)

**Session 1 — DB + cleaning layer ✅ (completed 2026-04-24)**
- Set up repo structure
- `db/connection.py`: SQLAlchemy engine, session factory, health check
- `db/views.sql`: create `inventariomesdetalle_clean` and `inventario_full`
- `scripts/bootstrap_views.py`: idempotent applier + invariant checks
- Validate: run `SELECT COUNT(*) FROM inventariomesdetalle_clean` — should be < 11,772,750
- Validate: corrupt row 90806848 is not in the clean view

Outcome: 11,740,729 clean rows (32,021 outliers filtered); inventario_full has
11,442,067 rows across 115 periods × 98 empresas. Empresa 956 confirmed as a
viable demo anchor (data through 2026-04). Re-run with `uv run python -m
scripts.bootstrap_views` — safe to invoke any time, all statements are
`CREATE OR REPLACE`.

**Session 2 — Analytical engine**
- `engine/cleaning.py`: outlier filter functions + validation helpers
- `engine/anomaly.py`: z-score + IQR detection, historical baseline query
- `engine/scoring.py`: composite priority scoring function
- `engine/report.py`: CierreReport assembler
- Test on empresa 956, any recent period

**Session 3 — MCP tools**
- `mcp/server.py`: FastMCP server setup
- Implement all 4 tools wired to the engine
- Unit test each tool in isolation with hardcoded test inputs

**Session 4 — LLM agent**
- `llm/prompts.py`: full system prompt with dynamic context injection
- `llm/agent.py`: tool-calling loop with SSE streaming
- `llm/streaming.py`: SSE event builder
- Test agent manually: ask the 5 demo questions, verify tool calls are correct

**Session 5 — FastAPI backend**
- `api/routes/`: all 4 route files
- `api/models.py`: Pydantic request/response models
- CORS configured for frontend dev server
- Test all endpoints with curl or HTTPie

**Session 6 — React frontend**
- Vite project scaffold, Tailwind + ShadCN setup
- `api/cierre.ts` + `api/chat.ts` clients
- `CompanySelect` + `PeriodSelect` components
- `KPICards` + `AnomalyList` components
- `ChatPanel` with SSE streaming and tool call indicators

**Session 7 — Integration + polish**
- Wire all components together
- Anomaly card click → pre-built chat message
- Cierre load skeleton + success toast
- Fix any type errors or API contract mismatches
- Run full demo flow end-to-end

**Session 8 — Demo preparation**
- Pick the best empresa + periodo for the pitch
- Verify top anomalies are meaningful
- Prepare and rehearse demo narrative
- Screenshot fallbacks

---

## 15. Conventions and non-negotiables

- **Never query `inventariomesdetalle` directly.** Always use `inventariomesdetalle_clean`.
- **Never let the LLM generate SQL.** All queries live in `db/queries/`. MCP tools call query functions, not raw SQL strings.
- **All monetary values in MXN.** Always append " MXN" in display strings.
- **Periods are always "YYYY-MM" strings.** Never use datetime objects across API boundaries.
- **The CierreReport is the single source of truth** for a session. Do not re-query the DB for data that's already in the report.
- **System prompt is injected fresh on every request.** Do not cache the agent state between HTTP requests.
- **All DB queries are read-only.** The backend user should have SELECT-only privileges in production. Never execute INSERT, UPDATE, or DELETE.
- **Log every LLM tool call** to stdout with timestamp, tool name, and execution time. This is critical for debugging during the pitch.
- **Spanish in the UI and in LLM responses.** Code, comments, and variable names can be in English.
