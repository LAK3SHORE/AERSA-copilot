import { getJSON } from "./client";
import type { CierreReport } from "../types/cierre";

export function fetchCierre(
  idempresa: number,
  periodo: string,
  topN = 100,
): Promise<CierreReport> {
  const q = new URLSearchParams({ top_n: String(topN) });
  return getJSON<CierreReport>(
    `/api/cierre/${idempresa}/${encodeURIComponent(periodo)}?${q}`,
  );
}
