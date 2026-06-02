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
    total_chat_messages: number;
    sessions_with_mcp: number;
    avg_mcp_calls_per_active_session: number;
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
}
