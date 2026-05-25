import { patchJSON } from "./client";
import type { FindingStatus } from "../types";

export function updateFindingStatus(
  idinventariomesdetalle: number,
  status: FindingStatus,
  opts?: { sessionId?: number; idempresa?: number },
): Promise<{ idinventariomesdetalle: number; status: FindingStatus }> {
  return patchJSON(`/api/findings/${idinventariomesdetalle}/status`, {
    status,
    session_id: opts?.sessionId ?? null,
    idempresa: opts?.idempresa ?? null,
  });
}
