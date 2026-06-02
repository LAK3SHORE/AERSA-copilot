import type { CorporativoDashboard } from "../types";
import { mcpToolLabel } from "./mcpToolLabels";

export function promptSessions(d: CorporativoDashboard): string {
  const o = d.overview;
  return (
    `En los últimos ${d.period_days} días hubo ${o.total_sessions} sesiones de auditoría ` +
    `con ${o.active_auditors} auditores activos, ${o.total_chat_messages ?? 0} mensajes de chat ` +
    `y ${o.sessions_with_mcp ?? 0} sesiones con uso de herramientas MCP. ` +
    `¿Qué empresas o auditores están rezagados y qué acciones recomiendas para AERSA?`
  );
}

export function promptToolCalls(d: CorporativoDashboard): string {
  const o = d.overview;
  return (
    `Se registraron ${o.total_tool_calls} llamadas MCP en ${o.distinct_tools} herramientas distintas ` +
    `en los últimos ${d.period_days} días. ¿Qué patrón de uso revela esto sobre la profundidad del copiloto ` +
    `y qué herramientas deberíamos promover o capacitar?`
  );
}

export function promptMostUsed(d: CorporativoDashboard): string {
  const t = d.tools.most_used;
  if (!t) {
    return "No hay llamadas MCP registradas aún. ¿Qué implica esto para la adopción del copiloto?";
  }
  return (
    `La herramienta MCP más usada es «${mcpToolLabel(t.tool_name)}» con ${t.total_calls} invocaciones ` +
    `(promedio ${Math.round(t.avg_duration_ms)} ms, ${t.errors} errores, ${t.unique_users} usuarios). ` +
    `¿Por qué domina, qué riesgos tiene depender de ella, y qué deberíamos vigilar?`
  );
}

export function promptLeastUsed(d: CorporativoDashboard): string {
  const t = d.tools.least_used;
  if (!t) {
    return "No hay datos de herramientas MCP. ¿Cómo deberíamos interpretar la adopción?";
  }
  return (
    `La herramienta MCP menos usada es «${mcpToolLabel(t.tool_name)}» con solo ${t.total_calls} invocaciones ` +
    `en ${d.period_days} días. ¿Es subutilización, falta de capacitación, o no aplica al flujo actual? ` +
    `¿Qué recomendarías para aumentar su uso donde aporte valor?`
  );
}

export function promptEmpresa(
  row: CorporativoDashboard["by_empresa"][0],
  days: number,
): string {
  return (
    `Para la empresa id ${row.idempresa} en los últimos ${days} días: ` +
    `${row.audit_sessions} sesiones, ${row.auditors} auditores, ${row.chat_messages} mensajes de chat, ` +
    `${row.tool_calls} llamadas MCP. ¿Están usando el copiloto a fondo? ¿Qué debería hacer el corporativo?`
  );
}

export function promptAuditor(
  row: CorporativoDashboard["by_auditor"][0],
  days: number,
): string {
  return (
    `El auditor "${row.username}" (user_id ${row.user_id}) tuvo ${row.total_sessions} sesiones y ` +
    `${row.total_calls} llamadas MCP en ${days} días (última actividad: ${row.last_active ?? "—"}). ` +
    `¿Cómo calificarías su adopción del copiloto y qué coaching recomendarías?`
  );
}

export function promptToolRanking(d: CorporativoDashboard): string {
  const lines = d.tools.ranking
    .slice(0, 6)
    .map((t) => `- ${mcpToolLabel(t.tool_name)}: ${t.total_calls} llamadas`)
    .join("\n");
  return (
    `Ranking de herramientas MCP (últimos ${d.period_days} días):\n${lines}\n\n` +
    `¿Hay desbalance preocupante, herramientas ignoradas, o señales de que solo usan el resumen superficial?`
  );
}
