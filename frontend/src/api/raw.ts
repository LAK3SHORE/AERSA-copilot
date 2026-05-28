import { getJSON } from "./client";
import type { RawCierreResponse } from "../types/raw";

export function fetchRawCierre(
  idempresa: number,
  periodo: string,
  tabla = "cierre_detalle",
): Promise<RawCierreResponse> {
  const q = new URLSearchParams({
    idempresa: String(idempresa),
    periodo,
    tabla,
    limit: "5000",
  });
  return getJSON<RawCierreResponse>(`/api/raw/cierre?${q}`);
}
