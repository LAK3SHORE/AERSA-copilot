import { getJSON } from "./client";
import type { AuditBrief } from "../types";

export function fetchBrief(
  idempresa: number,
  periodo: string,
  sessionId?: number | null,
): Promise<AuditBrief> {
  const q = sessionId != null ? `?session_id=${sessionId}` : "";
  return getJSON<AuditBrief>(`/api/brief/${idempresa}/${periodo}${q}`);
}
