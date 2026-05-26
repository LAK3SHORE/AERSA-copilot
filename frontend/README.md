# AERSA Copilot — Frontend Overview

React + Vite + TypeScript + Tailwind UI for **TALOS Copiloto Analítico de Auditoría** — an inventory audit assistant for AERSA restaurant operators. The frontend talks to the FastAPI backend through a `/api` Vite dev proxy.

---

## Visual language

The UI follows an **editorial audit terminal** aesthetic: warm cream ground, dark teal ink, and green accents. It is designed to feel like a professional audit workstation rather than a generic chat app.

| Element | Treatment |
|---|---|
| **Ground** | Cream `#F8F3E1` page background |
| **Typography** | IBM Plex Sans (UI copy) + IBM Plex Mono (labels, numbers, metadata) |
| **Accent** | Deep green `#285A48` for primary actions and highlights |
| **Severity** | Colored left bars on anomaly rows — CRÍTICO (red), ALTO (orange), MEDIO (ochre), BAJO (sage) |
| **Numbers** | Tabular monospace, prominent in KPI tiles |
| **Borders** | Hairline dividers (`rgba(9,20,19,0.10)`) instead of heavy boxes |
| **Motion** | Subtle fade-in on load states; blink animation on loading indicators |

Shared utility classes live in `src/styles/global.css` — notably `.label-eyebrow`, `.hairline`, `.num`, `.severity-bar`, and `.md-content` (assistant markdown rendering).

---

## Role-based routing

After login, the app renders one of two top-level experiences:

| Role | Route target | Purpose |
|---|---|---|
| `auditor` | `AuditorPage` | Full cierre audit workflow for one assigned empresa |
| `corporativo` | `CorporativoPage` | Adoption analytics + embedded auditor preview |

Auth is JWT-based via `AuthContext`. Token is stored in memory and attached to all `/api/*` requests.

**Demo credentials**

- Corporativo: `admin` / `aersa2026`
- Auditor: `auditor_956` / `talos2026`

---

## Screens & layout

All authenticated views share a **two-column split** on large screens:

```
┌─────────────────────────────────────────────────────────────┐
│  Header (brand, session context, status, logout)            │
├──────────────────────────┬──────────────────────────────────┤
│  Left panel (~40%)       │  Right panel — Chat (~60%)       │
│  Selectors, KPIs, lists  │  Streaming LLM conversation      │
├──────────────────────────┴──────────────────────────────────┤
│  Footer (metadata / data source)                            │
└─────────────────────────────────────────────────────────────┘
```

On mobile the layout stacks vertically. Section numbers (`01`, `02`, `03`…) in eyebrow labels give a guided reading order through the audit flow.

---

## Screenshots

> Add your captures below. Suggested filenames are shown — drop images in `frontend/docs/screenshots/` or update paths as needed.

### 1. Login page

Centered card on cream background. Username + password fields, demo credential hints, and a single “Iniciar sesión” action.

<!-- Replace with your screenshot -->
<!-- ![Login](./docs/screenshots/login.png) -->

**Key elements:** `LoginPage` · minimal chrome · role-agnostic entry point

---

### 2. Auditor view

Full audit workspace for loading a **Cierre de Semana**, reviewing KPIs and prioritized findings, and chatting with the copilot. Auditors are locked to their assigned `idempresa`.

<!-- Replace with your screenshot -->
<!-- ![Auditor view](./docs/screenshots/auditor-view.png) -->

**Left panel (top → bottom)**

1. **Sesión de Auditoría** — empresa + periodo selector (`Selector`)
2. **¿Por dónde empiezo?** — auto-generated guided briefing (`GuidedBriefing`)
3. **Indicadores Clave** — headline faltante total + clickable KPI tiles (`KPICards`)
4. **Hallazgos Priorizados** — ranked anomaly list with severity bars (`AnomalyList`)

**Right panel**

- **Conversación** — SSE-streamed chat with MCP tool call traces (`ChatPanel`, `MessageBubble`, `ToolCallTrace`)

**Header:** live clock, empresa/periodo badges, connection status dot (INACTIVO → CARGANDO → EN LÍNEA)

**Footer:** session id, TALOS/MariaDB read-only note

---

### 3. Admin — Panel de adopción

Corporativo landing tab. Left side shows adoption KPIs from `analytics.db`; right side is the owner chat (no MCP — analytics JSON injected into prompt).

<!-- Replace with your screenshot -->
<!-- ![Admin adoption panel](./docs/screenshots/admin-adoption-panel.png) -->

**Left panel sections** (`CorporativoDashboard`)

- **Uso del copiloto** — total sessions, active auditors, avg questions/session
- **Herramientas MCP** — most/least used tools + horizontal bar ranking
- **Por empresa** — per-empresa session and tool-call counts
- **Auditores** — per-user usage breakdown

Every tile/card is clickable and pre-fills a question in the owner chat.

**Right panel:** corporativo chat mode (`mode="corporativo"`) — label reads `OWNER · analytics`

**Header:** tab switcher — **Panel** | **Vista auditor** | Salir

---

### 4. Admin — Vista auditor

Same audit UX as the standalone auditor page, embedded under the corporativo header. Corporativo users can pick any empresa (not locked). Finding status controls are hidden (auditor-only feature).

<!-- Replace with your screenshot -->
<!-- ![Admin auditor view](./docs/screenshots/admin-auditor-view.png) -->

Both admin tabs stay mounted during the session (hidden via CSS) so chat history, loaded cierre data, and dashboard state persist when switching tabs. State resets on logout.

---

## Pages

| Page | File | Description |
|---|---|---|
| `LoginPage` | `src/pages/LoginPage.tsx` | JWT login form |
| `AuditorPage` | `src/pages/AuditorPage.tsx` | Main audit workflow; supports `embedded` prop for corporativo tab |
| `CorporativoPage` | `src/pages/CorporativoPage.tsx` | Admin shell with adoption panel + embedded auditor tab |
| `AnalyticsPage` | `src/pages/AnalyticsPage.tsx` | Legacy standalone analytics view (not currently wired in `App.tsx`) |

---

## Components

### Layout & chrome

| Component | Role |
|---|---|
| `Header` | Auditor top bar — TALOS branding, empresa/periodo, status dot, clock |
| `CorporativoHeader` | Admin top bar — tab switcher between Panel and Vista auditor |

### Audit data panel

| Component | Role |
|---|---|
| `Selector` | Empresa + periodo picker; triggers cierre load |
| `GuidedBriefing` | “¿Por dónde empiezo?” ranked action list from `generate_audit_brief` |
| `KPICards` | Cierre KPI summary — faltante total marquee + clickable metric tiles |
| `AnomalyList` | Prioritized findings with severity bars, selection highlight, optional status dropdown |

### Corporativo analytics panel

| Component | Role |
|---|---|
| `CorporativoDashboard` | Adoption KPI tiles, MCP tool ranking, per-empresa/auditor breakdown |

### Chat

| Component | Role |
|---|---|
| `ChatPanel` | Message list + empty state + input; supports `cierre` and `corporativo` modes |
| `MessageBubble` | User (mono) vs assistant (markdown) message rendering |
| `ChatInput` | Text input with submit; disabled while streaming or data not ready |
| `ToolCallTrace` | Inline MCP tool call indicator (running ✓ ✕) during auditor chat |

---

## Supporting modules

```
src/
├── api/          # fetch wrappers — auth, cierre, chat (SSE), analytics, findings, sessions
├── auth/         # AuthContext — JWT login/logout, token injection
├── components/   # Presentational UI (see table above)
├── lib/          # format helpers, finding prompt builders, corporativo prompt templates
├── pages/        # Route-level screens
├── styles/       # global.css — Tailwind layers + markdown styles
└── types/        # Shared TS interfaces (CierreReport, ChatMessage, CorporativoDashboard, …)
```

### Key interactions

- **Click a KPI tile or anomaly** → sends a contextual question to the copilot with optional `finding_context`
- **Click a corporativo dashboard card** → pre-fills an adoption question in owner chat
- **Guided briefing action** → sends a suggested prompt tied to a specific finding
- **Auditor finding status** → PATCH `/api/findings/{id}/status` (auditor role only)
- **Session tracking** → audit sessions logged to `analytics.db` on cierre load; ended on logout/unload

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 |
| Build | Vite 5 |
| Language | TypeScript |
| Styling | Tailwind CSS 3 + custom design tokens |
| Markdown | react-markdown + remark-gfm (assistant replies) |
| Fonts | IBM Plex Sans / Mono (Google Fonts) |
| API | REST + SSE streaming via `/api` proxy |

---

## Run

```bash
# 1. Install deps (one-shot)
npm install

# 2. Start the backend first (from ../backend)
#    uv run uvicorn main:app --port 8000   (or 8001 if 8000 is busy)

# 3. Start the dev server
npm run dev                       # http://localhost:5173

# Override the proxied backend if it's not on :8001 (the default):
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

## Build

```bash
npm run build      # type-check + vite build → dist/
npm run typecheck  # tsc --noEmit
npm run preview    # serve production build locally
```

---

## Screenshot checklist

When capturing for documentation, these four views cover the full frontend surface:

- [ ] **Login** — empty form or filled with demo user
- [ ] **Auditor view** — cierre loaded (empresa + periodo selected, briefing + KPIs + anomalies visible)
- [ ] **Admin adoption panel** — dashboard metrics loaded, owner chat visible
- [ ] **Admin auditor view** — embedded auditor with cierre loaded, corporativo header tabs visible

Recommended capture width: **1440px** (matches the `lg:` two-column breakpoint).
