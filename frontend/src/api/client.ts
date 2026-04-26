// Vite proxies /api/* to the backend (vite.config.ts), so we use relative
// paths in dev and the same-origin path in any deployed setup.
const BASE = "";

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!r.ok) {
    const detail = await r.text().catch(() => r.statusText);
    throw new ApiError(r.status, detail || r.statusText);
  }
  return r.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(`HTTP ${status}: ${detail}`);
  }
}

export { getJSON, BASE };
