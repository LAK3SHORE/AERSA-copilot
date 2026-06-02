import { getJSON } from "./client";
import type { AuditBrief } from "../types";

export function fetchBrief(
  idempresa: number,
  periodo: string,
  sessionId?: number | null,
  topN = 20,
): Promise<AuditBrief> {
  const params = new URLSearchParams({ top_n: String(topN) });
  if (sessionId != null) params.set("session_id", String(sessionId));
  return getJSON<AuditBrief>(
    `/api/brief/${idempresa}/${encodeURIComponent(periodo)}?${params}`,
  );
}
