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
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; status: "running" | "done" | "error"; arguments?: Record<string, unknown> }[];
  pending?: boolean;
  sqlResult?: SqlResultPayload;
}
