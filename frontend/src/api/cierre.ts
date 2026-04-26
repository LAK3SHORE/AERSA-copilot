import { getJSON } from "./client";
import type { CierreReport } from "../types";

export function fetchCierre(idempresa: number, periodo: string): Promise<CierreReport> {
  return getJSON<CierreReport>(`/api/cierre/${idempresa}/${encodeURIComponent(periodo)}`);
}
