// SSE client for POST /api/chat. EventSource is GET-only, so we hand-roll
// the framing: read the response body as a stream, buffer until we hit
// `\n\n` (one SSE event), and parse the `data:` line as JSON.

import type { ChatEvent, ChatHistoryMessage } from "../types";

export interface ChatRequest {
  idempresa: number;
  periodo: string;
  message: string;
  history: ChatHistoryMessage[];
}

export interface ChatStreamHandlers {
  onEvent: (evt: ChatEvent) => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}

export async function streamChat(
  body: ChatRequest,
  { onEvent, onError, signal }: ChatStreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    onError?.(err as Error);
    return;
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => res.statusText);
    onError?.(new Error(`HTTP ${res.status}: ${detail}`));
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
