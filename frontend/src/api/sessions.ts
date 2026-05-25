import { postJSON } from "./client";

export function logSessionEvent(
  sessionId: number,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return postJSON(`/api/sessions/${sessionId}/events`, {
    event_type: eventType,
    payload,
  });
}

export function endSession(
  sessionId: number,
  durationSeconds?: number,
): Promise<{ ok: boolean }> {
  return postJSON(`/api/sessions/${sessionId}/end`, {
    duration_seconds: durationSeconds ?? null,
  });
}
