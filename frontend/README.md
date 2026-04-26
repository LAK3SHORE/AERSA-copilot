# AERSA Copilot — Frontend

React + Vite + TypeScript + Tailwind. Talks to the FastAPI backend
through a `/api` Vite proxy.

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
```

## Aesthetic

Editorial Audit Terminal — warm-dark, Instrument Serif × Geist × Geist
Mono. Severity carried by colored left bars on rows; numerics tabular and
prominent. Single saturated amber as the only accent.
