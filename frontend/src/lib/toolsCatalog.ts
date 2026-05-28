import type { Herramienta } from "../types/cierre";

/** Static MCP tool cards (prototype T.herramientas). */
export function buildToolCatalog(idempresa: number, periodo: string): Herramienta[] {
  return [
    {
      nombre: "get_top_anomalies",
      desc: "Obtiene las N anomalías más graves del cierre, ordenadas por score ponderado.",
      ejemplo: "¿Cuáles son los 10 hallazgos más críticos de este cierre?",
      prompt: `Muéstrame las 10 anomalías más graves del cierre ${periodo} de Empresa ${idempresa}.`,
    },
    {
      nombre: "get_cierre_summary",
      desc: "Resumen ejecutivo del cierre: faltante total, conteos, categorías más afectadas.",
      ejemplo: "¿Cuánto es el faltante total y qué categorías están más afectadas?",
      prompt: `Dame un resumen ejecutivo completo del cierre ${periodo}.`,
    },
    {
      nombre: "get_category_shrinkage",
      desc: "Desglose de merma y faltante agrupado por categoría de producto.",
      ejemplo: "¿Cómo se distribuye la merma entre las categorías del cierre?",
      prompt: `Muéstrame el desglose de merma por categoría para el cierre ${periodo}.`,
    },
    {
      nombre: "get_product_history",
      desc: "Historial de inventario de un producto específico en los últimos N períodos.",
      ejemplo: "¿Cómo ha evolucionado el stock de este producto en los últimos 5 cierres?",
      prompt: "Dame el historial de los últimos 5 períodos del producto seleccionado.",
    },
    {
      nombre: "generate_audit_brief",
      desc: "Genera un brief narrativo completo del cierre, listo para reportar a supervisión.",
      ejemplo: "¿Puedes generar el reporte de auditoría para este cierre?",
      prompt: `Genera el brief de auditoría completo para el cierre ${periodo} de Empresa ${idempresa}.`,
    },
  ];
}
