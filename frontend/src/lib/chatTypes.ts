import type { FindingContextPayload } from "./findingPrompt";

export type ChatMode = "audit" | "analytics" | "sql";

export type OpenChatFn = (
  prompt: string,
  mode?: ChatMode,
  opts?: { findingContext?: FindingContextPayload },
) => void;

export interface SqlResultPayload {
  sql: string;
  explanation: string;
  columns: string[];
  rows: unknown[][];
  row_count: number;
  /** True when the result hit the MAX_ROWS cap and was cut off server-side. */
  truncated?: boolean;
}

/** Subset filter applied to Datos Raw rows after an NL→SQL query. */
export interface SqlRawRowFilter {
  productIds?: number[];
  almacenIds?: number[];
  productNames?: string[];
  almacenNames?: string[];
  /** Normalized keys for exact match (avoids substring false positives). */
  productNameKeys?: Set<string>;
  almacenNameKeys?: Set<string>;
}

export interface SqlDatosRawPayload {
  idempresa: number;
  periodo: string;
  sql: string;
  explanation: string;
  sqlRowCount: number;
  filter: SqlRawRowFilter | null;
  /** Bumps on each request so Datos Raw reloads even for the same query. */
  requestId: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; status: "running" | "done" | "error"; arguments?: Record<string, unknown> }[];
  pending?: boolean;
  sqlResult?: SqlResultPayload;
}
