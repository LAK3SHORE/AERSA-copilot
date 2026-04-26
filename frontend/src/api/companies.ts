import { getJSON } from "./client";
import type { Company } from "../types";

export function fetchCompanies(limit = 10): Promise<Company[]> {
  return getJSON<Company[]>(`/api/companies?limit=${limit}`);
}
