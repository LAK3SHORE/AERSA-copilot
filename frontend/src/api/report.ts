import { getJSON } from "./client";
import type { ReportBundle } from "../types/report";

export function fetchReportBundle(idempresa: number, periodo: string): Promise<ReportBundle> {
  return getJSON<ReportBundle>(
    `/api/report/${idempresa}/${encodeURIComponent(periodo)}`,
  );
}
