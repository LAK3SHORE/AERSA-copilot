export * from "./cierre";
export * from "./analytics";
export * from "./raw";


/** @deprecated use Hallazgo */
export type { Hallazgo as AnomalyRecord } from "./cierre";

/** @deprecated use AccionItem */
export type { AccionItem as AuditBriefAction } from "./cierre";

export interface Company {
  idempresa: number;
  nombre: string;
  num_inventarios: number;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallIndicator {
  name: string;
  status: "running" | "done" | "error";
  arguments?: Record<string, unknown>;
}

export type { ChatMessage } from "../lib/chatTypes";

export type ChatEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; status: "running"; arguments?: Record<string, unknown> }
  | { type: "tool_result"; name: string; status: "done" | "error"; error?: string }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

export interface AnalyticsOverview {
  period_days: number;
  total_sessions: number;
  active_auditors: number;
  avg_questions_per_session: number;
  tool_distribution: { tool_name: string; total_calls: number }[];
  sessions_by_week: { week: string; sessions: number }[];
  daily_trend: { day: string; calls: number; active_users: number }[];
}
