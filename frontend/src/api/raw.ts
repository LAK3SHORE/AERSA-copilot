import { getJSON } from "./client";
import type { RawCierreResponse } from "../types/raw";

export function fetchRawCierre(
  idempresa: number,
  periodo: string,
  tabla = "cierre_detalle",
  opts?: { limit?: number; offset?: number },
): Promise<RawCierreResponse> {
  const q = new URLSearchParams({
    idempresa: String(idempresa),
    periodo,
    tabla,
    limit: String(opts?.limit ?? 5000),
    offset: String(opts?.offset ?? 0),
  });
  return getJSON<RawCierreResponse>(`/api/raw/cierre?${q}`);
}

/** Paginate until all cierre detalle rows are loaded (for SQL→Raw cross-filter). */
export async function fetchAllRawCierre(
  idempresa: number,
  periodo: string,
  tabla = "cierre_detalle",
): Promise<RawCierreResponse> {
  const limit = 5000;
  let offset = 0;
  let allRows: RawCierreResponse["rows"] = [];
  let total = 0;
  let first: RawCierreResponse | null = null;

  while (true) {
    const page = await fetchRawCierre(idempresa, periodo, tabla, { limit, offset });
    if (!first) first = page;
    total = page.total_rows;
    allRows = allRows.concat(page.rows);
    if (allRows.length >= total || page.rows.length < limit) break;
    offset += limit;
  }

  return {
    ...(first as RawCierreResponse),
    rows: allRows,
    total_rows: total,
  };
}
