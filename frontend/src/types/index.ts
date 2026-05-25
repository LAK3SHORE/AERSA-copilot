// Mirrors backend Pydantic models (CLAUDE.md 10.4 originally specified
// camelCase, but snake_case avoids a translation layer — the API ships
// snake_case from FastAPI and we consume it as-is.

export type SeverityLabel = "CRÍTICO" | "ALTO" | "MEDIO" | "BAJO";
export type FindingStatus = "pendiente" | "revisado" | "escalado";

export interface Company {
  idempresa: number;
  nombre: string;
  num_inventarios: number;
}

export interface KPISummary {
  idempresa: number;
  periodo: string;
  num_almacenes: number;
  num_productos: number;
  num_lineas: number;
  total_importe_fisico_mxn: number;
  total_faltantes_mxn: number;
  total_sobrantes_mxn: number;
  total_compras_unidades: number;
  total_ventas_unidades: number;
  top_categoria_faltante: string;
  pct_lineas_con_merma: number;
}

export interface AnomalyRecord {
  idinventariomesdetalle: number;
  idproducto: number;
  producto_nombre: string;
  idcategoria: number | null;
  categoria_nombre: string;
  subcategoria_nombre: string;
  idalmacen: number;
  almacen_nombre: string;
  idsucursal: number;
  periodo: string;
  merma_rate: number | null;
  z_score: number | null;
  financial_impact_mxn: number;
  priority_score: number;
  severity_label: SeverityLabel;
  mean_merma_rate_hist: number | null;
  recurrence_count: number;
  unidad_medida: string;
}

export interface CierreReport {
  idempresa: number;
  periodo: string;
  generated_at: string;
  kpis: KPISummary;
  top_anomalies: AnomalyRecord[];
  total_anomalies_found: number;
  data_quality_warnings: string[];
  audit_session_id?: number | null;
  finding_statuses?: Record<number, string>;
}

export interface AuditBriefAction {
  rank: number;
  idinventariomesdetalle: number;
  idproducto: number;
  idalmacen: number;
  producto_nombre: string;
  almacen_nombre: string;
  severity_label: SeverityLabel;
  title: string;
  reason: string;
  suggested_prompt: string;
}

export interface AuditBrief {
  idempresa: number;
  periodo: string;
  headline: string;
  summary: string;
  action_count: number;
  actions: AuditBriefAction[];
}

export interface McpToolUsageRow {
  tool_name: string;
  total_calls: number;
  avg_duration_ms: number;
  unique_users: number;
  errors: number;
}

export interface CorporativoDashboard {
  period_days: number;
  overview: {
    total_sessions: number;
    active_auditors: number;
    avg_questions_per_session: number;
    total_tool_calls: number;
    distinct_tools: number;
  };
  tools: {
    total_calls: number;
    ranking: McpToolUsageRow[];
    most_used: McpToolUsageRow | null;
    least_used: McpToolUsageRow | null;
  };
  by_empresa: {
    idempresa: number;
    audit_sessions: number;
    auditors: number;
    chat_messages: number;
    tool_calls: number;
    sessions_with_tools: number;
  }[];
  by_auditor: {
    user_id: number;
    username: string;
    role: string;
    total_calls: number;
    total_sessions: number;
    last_active: string | null;
  }[];
  daily_trend: { day: string; calls: number; active_users: number }[];
  recent_sessions: {
    id: number;
    username: string;
    idempresa: number;
    periodo: string;
    started_at: string;
    event_count: number;
    chat_messages: number;
    coverage_score?: number | null;
  }[];
}

export interface AnalyticsOverview {
  period_days: number;
  total_sessions: number;
  active_auditors: number;
  avg_questions_per_session: number;
  tool_distribution: { tool_name: string; total_calls: number }[];
  sessions_by_week: { week: string; sessions: number }[];
  daily_trend: { day: string; calls: number; active_users: number }[];
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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallIndicator[];
  pending?: boolean;
}

// SSE event payloads from POST /api/chat
export type ChatEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; status: "running"; arguments?: Record<string, unknown> }
  | { type: "tool_result"; name: string; status: "done" | "error"; error?: string }
  | { type: "done"; content: string }
  | { type: "error"; message: string };
