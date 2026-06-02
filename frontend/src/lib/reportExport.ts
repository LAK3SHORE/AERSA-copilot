import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { AuditBrief, CierreReport, Hallazgo } from "../types/cierre";
import type { ReportBundle } from "../types/report";
import { fmtPeriodo, mxn, num, pct } from "./fmt";

export interface ReportExportData {
  report: CierreReport;
  brief: AuditBrief | null;
  bundle: ReportBundle;
  findingStatuses: Record<number, string>;
}

const SEV_COLOR: Record<string, string> = {
  CRÍTICO: "#B83025",
  ALTO: "#C26020",
  MEDIO: "#9C7E10",
  BAJO: "#5E7B5A",
};

function barChartSvg(
  title: string,
  items: { label: string; value: number }[],
  width = 560,
  barH = 22,
): string {
  if (!items.length) {
    return `<p class="muted">Sin datos</p>`;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  const height = 48 + items.length * (barH + 6);
  const bars = items
    .map((item, idx) => {
      const y = 40 + idx * (barH + 6);
      const w = Math.max(4, (item.value / max) * (width - 200));
      const label = item.label.length > 28 ? `${item.label.slice(0, 26)}…` : item.label;
      return `
        <text x="0" y="${y + 14}" class="chart-label">${escapeHtml(label)}</text>
        <rect x="170" y="${y}" width="${w}" height="${barH}" fill="#84AC37" rx="2"/>
        <text x="${175 + w}" y="${y + 14}" class="chart-value">${escapeHtml(mxn(item.value))}</text>
      `;
    })
    .join("");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeHtml(title)}">
      <text x="0" y="18" class="chart-title">${escapeHtml(title)}</text>
      ${bars}
    </svg>
  `;
}

function severityPieSvg(counts: Record<string, number>): string {
  const order = ["CRÍTICO", "ALTO", "MEDIO", "BAJO"];
  const entries = order
    .map((k) => ({ k, v: counts[k] ?? 0 }))
    .filter((e) => e.v > 0);
  const total = entries.reduce((s, e) => s + e.v, 0);
  if (total === 0) return `<p class="muted">Sin hallazgos en el top</p>`;

  let angle = 0;
  const cx = 80;
  const cy = 80;
  const r = 64;
  const slices = entries
    .map(({ k, v }) => {
      const sweep = (v / total) * 360;
      const start = angle;
      angle += sweep;
      const end = angle;
      const large = sweep > 180 ? 1 : 0;
      const x1 = cx + r * Math.cos((Math.PI * start) / 180);
      const y1 = cy + r * Math.sin((Math.PI * start) / 180);
      const x2 = cx + r * Math.cos((Math.PI * end) / 180);
      const y2 = cy + r * Math.sin((Math.PI * end) / 180);
      const d =
        sweep >= 359.9
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return `<path d="${d}" fill="${SEV_COLOR[k] ?? "#999"}"/>`;
    })
    .join("");

  const legend = entries
    .map(
      ({ k, v }, i) =>
        `<text x="180" y="${24 + i * 18}" class="chart-label"><tspan fill="${SEV_COLOR[k]}">■</tspan> ${k}: ${v}</text>`,
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" width="100%" role="img" aria-label="Distribución por severidad">
      ${slices}
      ${legend}
    </svg>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hallazgoRows(hallazgos: Hallazgo[], statuses: Record<number, string>): string {
  if (!hallazgos.length) return `<tr><td colspan="10">Sin hallazgos</td></tr>`;
  return hallazgos
    .map(
      (h, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><span class="sev sev-${h.severity_label}">${h.severity_label}</span></td>
      <td>${escapeHtml(h.producto_nombre)}</td>
      <td>${escapeHtml(h.categoria_nombre)}</td>
      <td>${escapeHtml(h.almacen_nombre)}</td>
      <td class="num">${mxn(h.financial_impact_mxn)}</td>
      <td class="num">${h.z_score != null ? h.z_score.toFixed(2) : "—"}</td>
      <td class="num">${h.score_ponderado.toFixed(1)}</td>
      <td class="num">${h.merma_rate != null ? pct(h.merma_rate, true) : "—"}</td>
      <td>${escapeHtml(statuses[h.idinventariomesdetalle] ?? "—")}</td>
    </tr>`,
    )
    .join("");
}

export function buildReportHtml(data: ReportExportData): string {
  const { report, brief, bundle } = data;
  const k = report.kpis;
  const gen = new Date(report.generated_at).toLocaleString("es-MX");
  const catChart = barChartSvg(
    "Faltante por categoría (MXN)",
    bundle.category_breakdown.slice(0, 12).map((r) => ({
      label: r.categoria,
      value: r.total_merma_mxn,
    })),
  );
  const almChart = barChartSvg(
    "Faltante por almacén (MXN)",
    bundle.almacen_breakdown.slice(0, 12).map((r) => ({
      label: r.almacen,
      value: r.total_merma_mxn,
    })),
  );
  const sevChart = severityPieSvg(bundle.severity_counts);

  const actions = brief?.actions ?? bundle.brief.actions ?? [];
  const actionRows = actions
    .map(
      (a) => `
    <tr>
      <td>${a.rank}</td>
      <td><span class="sev sev-${a.severity_label}">${a.severity_label}</span></td>
      <td>${escapeHtml(a.producto_nombre)}</td>
      <td>${escapeHtml(a.almacen_nombre)}</td>
      <td>${escapeHtml(a.title)}</td>
      <td>${escapeHtml(a.reason)}</td>
    </tr>`,
    )
    .join("");

  const warnings =
    report.data_quality_warnings.length > 0
      ? `<ul>${report.data_quality_warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`
      : "<p class=\"muted\">Sin advertencias de calidad.</p>";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Reporte Cierre ${report.periodo} · Empresa ${report.idempresa}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "IBM Plex Sans", system-ui, sans-serif; color: #333; margin: 0; padding: 32px; background: #fff; font-size: 12px; line-height: 1.45; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 28px 0 10px; border-bottom: 2px solid #84AC37; padding-bottom: 4px; }
    .meta { font-family: "IBM Plex Mono", monospace; font-size: 10px; color: #666; margin-bottom: 24px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
    .kpi { border: 1px solid #ddd; padding: 10px; background: #FFFDF5; }
    .kpi label { display: block; font-family: monospace; font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.06em; }
    .kpi strong { font-family: monospace; font-size: 15px; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 16px 0; }
    .chart-box { border: 1px solid #e8e8e8; padding: 12px; background: #fafafa; }
    .chart-title { font-family: monospace; font-size: 11px; font-weight: 600; fill: #333; }
    .chart-label { font-family: sans-serif; font-size: 10px; fill: #444; }
    .chart-value { font-family: monospace; font-size: 9px; fill: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #869C4E; color: #fff; font-family: monospace; font-size: 9px; text-transform: uppercase; }
    tr:nth-child(even) { background: #f9f9f6; }
    .num { text-align: right; font-family: monospace; }
    .sev { font-family: monospace; font-size: 9px; font-weight: 600; padding: 2px 5px; border-radius: 2px; color: #fff; }
    .sev-CRÍTICO { background: #B83025; }
    .sev-ALTO { background: #C26020; }
    .sev-MEDIO { background: #9C7E10; }
    .sev-BAJO { background: #5E7B5A; }
    .summary { background: #FFF8E3; border-left: 3px solid #84AC37; padding: 12px 14px; margin: 12px 0; }
    .muted { color: #888; }
    @media print { body { padding: 16px; } .charts { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Reporte de Cierre de Semana</h1>
  <p class="meta">Empresa ${report.idempresa} · Período ${fmtPeriodo(report.periodo)} (${report.periodo}) · Generado ${gen}</p>

  <h2>Resumen ejecutivo</h2>
  <div class="summary">
    <p><strong>${escapeHtml(brief?.headline ?? bundle.brief.headline)}</strong></p>
    <p>${escapeHtml(brief?.summary ?? bundle.brief.summary)}</p>
  </div>

  <h2>Indicadores clave</h2>
  <div class="kpi-grid">
    <div class="kpi"><label>Faltante total</label><strong>${mxn(k.total_faltantes_mxn)}</strong></div>
    <div class="kpi"><label>Sobrantes</label><strong>${mxn(k.total_sobrantes_mxn)}</strong></div>
    <div class="kpi"><label>Importe físico</label><strong>${mxn(k.total_importe_fisico_mxn)}</strong></div>
    <div class="kpi"><label>Anomalías detectadas</label><strong>${num(report.total_anomalies_found)}</strong></div>
    <div class="kpi"><label>Almacenes</label><strong>${k.num_almacenes}</strong></div>
    <div class="kpi"><label>Productos</label><strong>${num(k.num_productos)}</strong></div>
    <div class="kpi"><label>Líneas</label><strong>${num(k.num_lineas)}</strong></div>
    <div class="kpi"><label>% líneas con merma</label><strong>${pct(k.pct_lineas_con_merma, true)}</strong></div>
    <div class="kpi"><label>Compras (u)</label><strong>${num(k.total_compras_unidades)}</strong></div>
    <div class="kpi"><label>Ventas (u)</label><strong>${num(k.total_ventas_unidades)}</strong></div>
    <div class="kpi"><label>Cat. más afectada</label><strong>${escapeHtml(k.top_categoria_faltante)}</strong></div>
    <div class="kpi"><label>Hallazgos en reporte</label><strong>${report.top_anomalies.length}</strong></div>
  </div>

  <h2>Visualizaciones</h2>
  <div class="charts">
    <div class="chart-box">${catChart}</div>
    <div class="chart-box">${almChart}</div>
  </div>
  <div class="chart-box" style="max-width:360px">${sevChart}</div>

  <h2>Desglose por categoría</h2>
  <table>
    <thead><tr><th>Categoría</th><th>Faltante MXN</th><th>% total</th><th>Productos</th></tr></thead>
    <tbody>
      ${bundle.category_breakdown
        .map(
          (r) => `<tr>
        <td>${escapeHtml(r.categoria)}</td>
        <td class="num">${mxn(r.total_merma_mxn)}</td>
        <td class="num">${pct(r.pct_del_total, true)}</td>
        <td class="num">${num(r.num_productos)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Desglose por almacén</h2>
  <table>
    <thead><tr><th>Almacén</th><th>Faltante MXN</th><th>% total</th><th>Líneas</th></tr></thead>
    <tbody>
      ${bundle.almacen_breakdown
        .map(
          (r) => `<tr>
        <td>${escapeHtml(r.almacen)}</td>
        <td class="num">${mxn(r.total_merma_mxn)}</td>
        <td class="num">${pct(r.pct_del_total, true)}</td>
        <td class="num">${num(r.num_lineas)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Calidad de datos</h2>
  ${warnings}

  <h2>Acciones prioritarias (${actions.length})</h2>
  <table>
    <thead><tr><th>#</th><th>Severidad</th><th>Producto</th><th>Almacén</th><th>Título</th><th>Motivo</th></tr></thead>
    <tbody>${actionRows || "<tr><td colspan=\"6\">Sin acciones</td></tr>"}</tbody>
  </table>

  <h2>Hallazgos priorizados (${report.top_anomalies.length})</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Severidad</th><th>Producto</th><th>Categoría</th><th>Almacén</th>
        <th>Impacto MXN</th><th>Z</th><th>Score</th><th>Merma</th><th>Estatus</th>
      </tr>
    </thead>
    <tbody>${hallazgoRows(report.top_anomalies, data.findingStatuses)}</tbody>
  </table>

  <p class="meta" style="margin-top:32px">AERSA Copilot · TALOS Analytical Audit · Documento generado automáticamente</p>
</body>
</html>`;
}

export function downloadReportHtml(data: ReportExportData): void {
  const html = buildReportHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte-cierre-${data.report.idempresa}-${data.report.periodo}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadReportPdf(rootEl: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(rootEl, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;
  let heightLeft = imgH;
  let position = margin;

  pdf.addImage(img, "PNG", margin, position, imgW, imgH);
  heightLeft -= pageH - margin * 2;

  while (heightLeft > 0) {
    position = heightLeft - imgH + margin;
    pdf.addPage();
    pdf.addImage(img, "PNG", margin, position, imgW, imgH);
    heightLeft -= pageH - margin * 2;
  }

  pdf.save(filename);
}
