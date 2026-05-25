import { getJSON } from "./client";
import type { AnalyticsOverview, CorporativoDashboard } from "../types";

export function fetchAnalyticsDashboard(days = 30): Promise<CorporativoDashboard> {
  return getJSON<CorporativoDashboard>(`/api/analytics/dashboard?days=${days}`);
}

export function fetchAnalyticsOverview(days = 30): Promise<AnalyticsOverview> {
  return getJSON<AnalyticsOverview>(`/api/analytics/overview?days=${days}`);
}

export function fetchUsageSummary(days = 30) {
  return getJSON<{
    period_days: number;
    by_tool: {
      tool_name: string;
      total_calls: number;
      avg_duration_ms: number;
      unique_users: number;
      errors: number;
    }[];
    by_user: {
      user_id: number;
      username: string;
      role: string;
      total_calls: number;
      total_sessions: number;
      last_active: string;
    }[];
    daily_trend: { day: string; calls: number; active_users: number }[];
  }>(`/api/analytics/usage-summary?days=${days}`);
}

export function fetchSessions(limit = 50) {
  return getJSON<{
    sessions: {
      id: number;
      username: string;
      idempresa: number;
      periodo: string;
      started_at: string;
      event_count: number;
      chat_messages: number;
      coverage_score?: number | null;
    }[];
    count: number;
  }>(`/api/analytics/sessions?limit=${limit}`);
}
