// Vite proxies /api/* to the backend (vite.config.ts), so we use relative
// paths in dev and the same-origin path in any deployed setup.

const BASE = "";

let _token: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

export function getAuthToken(): string | null {
  return _token;
}

export function setOnUnauthorized(handler: (() => void) | null) {
  _onUnauthorized = handler;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (_token) h.Authorization = `Bearer ${_token}`;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    Object.assign(h, extra as Record<string, string>);
  }
  return h;
}

async function handleResponse<T>(r: Response): Promise<T> {
  if (r.status === 401) {
    _onUnauthorized?.();
    throw new ApiError(401, "Sesión expirada o no autorizada");
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => r.statusText);
    throw new ApiError(r.status, detail || r.statusText);
  }
  return r.json() as Promise<T>;
}

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  return handleResponse<T>(r);
}

export async function patchJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(r);
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(r);
}

export async function postForm<T>(
  path: string,
  fields: Record<string, string>,
): Promise<T> {
  const body = new URLSearchParams(fields);
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
    body,
  });
  return handleResponse<T>(r);
}

export function authHeadersForStream(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  if (_token) h.Authorization = `Bearer ${_token}`;
  return h;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`HTTP ${status}: ${detail}`);
  }
}

export { BASE };
