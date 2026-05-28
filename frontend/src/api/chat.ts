// SSE client for POST /api/chat. EventSource is GET-only, so we hand-roll
// the framing: read the response body as a stream, buffer until we hit
// `\n\n` (one SSE event), and parse the `data:` line as JSON.

import { authHeadersForStream, ApiError } from "./client";
import type { ChatEvent, ChatHistoryMessage } from "../types";
import type { FindingContextPayload } from "../lib/findingPrompt";

export interface ChatRequest {
  idempresa: number;
  periodo: string;
  message: string;
  history: ChatHistoryMessage[];
  session_id?: number | null;
  suggested?: boolean;
  finding_context?: FindingContextPayload | null;
}

export interface ChatStreamHandlers {
  onEvent: (evt: ChatEvent) => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}

export interface CorporativoChatRequest {
  message: string;
  history: ChatHistoryMessage[];
  days?: number;
}

export async function streamCorporativoChat(
  body: CorporativoChatRequest,
  { onEvent, onError, signal }: ChatStreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/chat/corporativo", {
      method: "POST",
      headers: authHeadersForStream(),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    onError?.(err as Error);
    return;
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => res.statusText);
    onError?.(new ApiError(res.status, detail || res.statusText));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      let split: number;
      while ((split = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const dataLines = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart());
        if (dataLines.length === 0) continue;
        const payload = dataLines.join("\n");
        try {
          onEvent(JSON.parse(payload) as ChatEvent);
        } catch {
          /* skip */
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") onError?.(err as Error);
  }
}

export type Nl2SqlEvent =
  | { type: "sql_result"; sql: string; explanation: string; columns: string[]; rows: unknown[][]; row_count: number }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

export interface Nl2SqlRequest {
  message: string;
  history: ChatHistoryMessage[];
  idempresa: number;
  periodo: string;
  tabla: string;
}

async function consumeSse(
  res: Response,
  onEvent: (payload: unknown) => void,
  onError?: (err: Error) => void,
): Promise<void> {
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => res.statusText);
    onError?.(new ApiError(res.status, detail || res.statusText));
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      let split: number;
      while ((split = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const dataLines = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart());
        if (dataLines.length === 0) continue;
        try {
          onEvent(JSON.parse(dataLines.join("\n")));
        } catch {
          /* skip */
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") onError?.(err as Error);
  }
}

export async function streamNl2Sql(
  body: Nl2SqlRequest,
  { onEvent, onError, signal }: ChatStreamHandlers & { onEvent: (evt: Nl2SqlEvent) => void },
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/query/nl2sql", {
      method: "POST",
      headers: authHeadersForStream(),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    onError?.(err as Error);
    return;
  }
  await consumeSse(
    res,
    (payload) => onEvent(payload as Nl2SqlEvent),
    onError,
  );
}

export async function streamChat(
  body: ChatRequest,
  { onEvent, onError, signal }: ChatStreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: authHeadersForStream(),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    onError?.(err as Error);
    return;
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => res.statusText);
    onError?.(new ApiError(res.status, detail || res.statusText));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE permits LF, CR, or CRLF line endings (HTML spec). sse-starlette
      // emits CRLF, which doesn't contain a literal "\n\n" — normalise to LF
      // before scanning so a blank-line boundary is detectable either way.
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      // Split into complete SSE events (delimited by blank line).
      let split: number;
      while ((split = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const dataLines = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart());
        if (dataLines.length === 0) continue;
        const payload = dataLines.join("\n");
        try {
          onEvent(JSON.parse(payload) as ChatEvent);
        } catch {
          // Non-JSON keepalive or comment; skip.
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") onError?.(err as Error);
  }
}
