import type { McpToolUsageRow } from "../types/analytics";
import type { CorporativoDashboard } from "../types/analytics";
import { mcpToolLabel } from "./mcpToolLabels";

/** Owner-chat prompts when clicking an MCP tool in the adoption panel. */
export function promptMcpToolAdoption(tool: McpToolUsageRow, periodDays: number): string {
  const label = mcpToolLabel(tool.tool_name);
  return (
    `En los últimos ${periodDays} días la herramienta «${label}» ` +
    `registró ${tool.total_calls} llamadas MCP (${tool.unique_users} usuarios, ` +
    `${tool.errors} errores, ~${Math.round(tool.avg_duration_ms)} ms promedio). ` +
    `¿Qué indica este nivel de uso sobre la adopción del copiloto y qué recomiendas a AERSA?`
  );
}

/** Owner-chat prompt when clicking a row in Por Auditor. */
export function promptAuditorRow(
  row: CorporativoDashboard["by_auditor"][0],
  periodDays: number,
): string {
  return (
    `El auditor «${row.username}» tuvo ${row.total_sessions} sesiones y ` +
    `${row.total_calls} llamadas MCP en los últimos ${periodDays} días ` +
    `(última actividad: ${row.last_active ?? "sin registro"}). ` +
    `¿Cómo calificarías su adopción del copiloto y qué coaching recomendarías a AERSA?`
  );
}

/** Owner-chat prompt when clicking a row in Por Empresa. */
export function promptEmpresaRow(
  row: CorporativoDashboard["by_empresa"][0],
  periodDays: number,
): string {
  return (
    `Para la empresa ${row.idempresa} en los últimos ${periodDays} días: ` +
    `${row.audit_sessions} sesiones, ${row.auditors} auditores, ${row.chat_messages} mensajes de chat, ` +
    `${row.tool_calls} llamadas MCP. ¿Están usando el copiloto a fondo? ¿Qué debería hacer el corporativo?`
  );
}
