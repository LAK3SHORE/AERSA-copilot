/** User-facing labels for MCP tool names in analytics dashboards. */
const MCP_TOOL_LABELS: Record<string, string> = {
  get_top_anomalies: "Hallazgos más críticos",
  get_cierre_summary: "Resumen del cierre",
  get_category_shrinkage: "Merma por categoría",
  get_product_history: "Historial del producto",
  generate_audit_brief: "Brief de auditoría",
};

export function mcpToolLabel(toolName: string): string {
  return MCP_TOOL_LABELS[toolName] ?? toolName.replace(/_/g, " ");
}
