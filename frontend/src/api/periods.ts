import { getJSON } from "./client";

export function fetchPeriods(idempresa: number): Promise<string[]> {
  return getJSON<string[]>(`/api/periods/${idempresa}`);
}
