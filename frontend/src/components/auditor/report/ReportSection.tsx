import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchReportBundle } from "../../../api/report";
import type { AuditBrief, CierreReport, Hallazgo, SeverityLabel } from "../../../types/cierre";
import type { ReportBundle } from "../../../types/report";
import {
  downloadReportHtml,
  downloadReportPdf,
  type ReportExportData,
} from "../../../lib/reportExport";
import { fmtPeriodo, mxn, num, pct } from "../../../lib/fmt";
import { Section } from "../../shared/Section";
import { SeverityBadge } from "../../shared/SeverityBadge";
import {
  AlmacenBarChart,
  CategoryBarChart,
  SeverityLegend,
  SeverityPieChart,
} from "./ReportCharts";

export function ReportSection({
  report,
  brief,
  findingStatuses,
}: {
  report: CierreReport;
  brief: AuditBrief | null;
  findingStatuses: Record<number, string>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"html" | "pdf" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchReportBundle(report.idempresa, report.periodo)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report.idempresa, report.periodo]);

  const exportData = (): ReportExportData | null => {
    if (!bundle) return null;
    return { report, brief, bundle, findingStatuses };
  };

  const onHtml = () => {
    const data = exportData();
    if (!data) return;
    downloadReportHtml(data);
  };

  const onPdf = async () => {
    const el = rootRef.current;
    if (!el || !bundle) return;
    setExporting("pdf");
    try {
      await downloadReportPdf(
        el,
        `reporte-cierre-${report.idempresa}-${report.periodo}.pdf`,
      );
    } finally {
      setExporting(null);
    }
  };

  const k = report.kpis;
  const actions = brief?.actions ?? bundle?.brief.actions ?? [];
  const gen = new Date(report.generated_at).toLocaleString("es-MX");

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-7 py-3 border-b border-accent-3 bg-cream-2 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-sans text-sm font-medium text-ink">Generador de Reporte</div>
          <div className="font-mono text-[10px] text-ink-3 tracking-widish">
            Empresa {report.idempresa} · {fmtPeriodo(report.periodo)} · {gen}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!bundle || !!exporting}
            onClick={onHtml}
            className="font-mono text-[10px] tracking-widish px-3 py-1.5 border border-accent-2 bg-white text-ink hover:bg-accent-2/15 disabled:opacity-40 cursor-pointer"
          >
            DESCARGAR HTML
          </button>
          <button
            type="button"
            disabled={!bundle || !!exporting}
            onClick={() => void onPdf()}
            className="font-mono text-[10px] tracking-widish px-3 py-1.5 bg-accent text-ink border-0 hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {exporting === "pdf" ? "GENERANDO PDF…" : "DESCARGAR PDF"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="px-7 py-8 font-mono text-xs text-ink-3 animate-blink">
          Preparando desglose y gráficas…
        </div>
      )}
      {error && (
        <div className="px-7 py-6 font-mono text-xs text-crit">{error}</div>
      )}

      {bundle && !loading && (
        <div ref={rootRef} className="flex-1 overflow-y-auto px-7 py-6 bg-white">
          <header className="mb-6 pb-4 border-b-2 border-accent">
            <h1 className="font-sans text-xl font-medium text-ink mb-1">
              Reporte de Cierre de Semana
            </h1>
            <p className="font-mono text-[10px] text-ink-3">
              Empresa {report.idempresa} · Período {report.periodo} · Generado {gen}
            </p>
          </header>

          <Section num={1} label="Resumen ejecutivo">
            <div className="bg-cream border-l-[3px] border-l-accent-2 p-4">
              <p className="font-sans text-sm font-medium text-ink mb-2">
                {brief?.headline ?? bundle.brief.headline}
              </p>
              <p className="font-sans text-[12px] text-ink leading-relaxed">
                {brief?.summary ?? bundle.brief.summary}
              </p>
            </div>
          </Section>

          <Section num={2} label="Indicadores clave">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiTile label="Faltante total" value={mxn(k.total_faltantes_mxn)} highlight />
              <KpiTile label="Sobrantes" value={mxn(k.total_sobrantes_mxn)} />
              <KpiTile label="Importe físico" value={mxn(k.total_importe_fisico_mxn)} />
              <KpiTile label="Anomalías" value={num(report.total_anomalies_found)} />
              <KpiTile label="Almacenes" value={String(k.num_almacenes)} />
              <KpiTile label="Productos" value={num(k.num_productos)} />
              <KpiTile label="Líneas" value={num(k.num_lineas)} />
              <KpiTile label="% con merma" value={pct(k.pct_lineas_con_merma, true)} />
              <KpiTile label="Compras (u)" value={num(k.total_compras_unidades)} />
              <KpiTile label="Ventas (u)" value={num(k.total_ventas_unidades)} />
              <KpiTile label="Cat. más afectada" value={k.top_categoria_faltante} small />
              <KpiTile label="Hallazgos listados" value={String(report.top_anomalies.length)} />
            </div>
          </Section>

          <Section num={3} label="Visualizaciones">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartPanel title="Faltante por categoría">
                <CategoryBarChart data={bundle.category_breakdown} />
              </ChartPanel>
              <ChartPanel title="Faltante por almacén">
                <AlmacenBarChart data={bundle.almacen_breakdown} />
              </ChartPanel>
            </div>
            <ChartPanel title="Hallazgos por severidad (top del cierre)" className="mt-4 max-w-md">
              <SeverityPieChart counts={bundle.severity_counts} />
              <SeverityLegend counts={bundle.severity_counts} />
            </ChartPanel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <BreakdownTable
                title="Desglose por categoría"
                headers={["Categoría", "Faltante MXN", "% del total", "Productos"]}
                rows={bundle.category_breakdown.map((r) => [
                  r.categoria,
                  mxn(r.total_merma_mxn),
                  pct(r.pct_del_total, true),
                  num(r.num_productos),
                ])}
              />
              <BreakdownTable
                title="Desglose por almacén"
                headers={["Almacén", "Faltante MXN", "% del total", "Líneas"]}
                rows={bundle.almacen_breakdown.map((r) => [
                  r.almacen,
                  mxn(r.total_merma_mxn),
                  pct(r.pct_del_total, true),
                  num(r.num_lineas),
                ])}
              />
            </div>
          </Section>

          {report.data_quality_warnings.length > 0 && (
            <Section num={4} label="Calidad de datos">
              <ul className="font-mono text-[11px] text-ink-2 list-disc pl-5 space-y-1">
                {report.data_quality_warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section num={5} label={`Acciones prioritarias (${actions.length})`}>
            <div className="overflow-x-auto border border-ink/10">
              <table className="w-full text-left border-collapse font-sans text-[11px]">
                <thead>
                  <tr className="bg-stepper text-cream font-mono text-[9px] uppercase tracking-wide2">
                    <th className="p-2">#</th>
                    <th className="p-2">Sev.</th>
                    <th className="p-2">Producto</th>
                    <th className="p-2">Almacén</th>
                    <th className="p-2">Título</th>
                    <th className="p-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.rank} className="border-t border-ink/10 even:bg-cream-2/50">
                      <td className="p-2 font-mono text-ink-3">{a.rank}</td>
                      <td className="p-2">
                        <SeverityBadge level={a.severity_label as SeverityLabel} />
                      </td>
                      <td className="p-2 font-medium">{a.producto_nombre}</td>
                      <td className="p-2 text-ink-2">{a.almacen_nombre}</td>
                      <td className="p-2">{a.title}</td>
                      <td className="p-2 text-ink-2 font-mono text-[10px]">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section num={6} label={`Hallazgos priorizados (${report.top_anomalies.length})`}>
            <HallazgosTable rows={report.top_anomalies} statuses={findingStatuses} />
          </Section>

          <p className="font-mono text-[9px] text-ink-4 tracking-widish mt-8 pb-4">
            AERSA Copilot · TALOS · El HTML exportado incluye gráficas embebidas; el PDF captura esta vista.
          </p>
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  highlight,
  small,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`border border-accent-3 p-3 ${highlight ? "bg-[rgb(208,219,151)]" : "bg-cream-2"}`}
    >
      <div className="font-mono text-[9px] tracking-widish text-ink-3 mb-1 font-semibold">{label}</div>
      <div
        className={`font-mono font-medium text-ink ${small ? "text-[11px] leading-snug" : "text-[15px]"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-ink/10 bg-cream-2/30 p-3 ${className}`}>
      <div className="font-mono text-[10px] tracking-widish text-ink-3 mb-2 font-semibold">{title}</div>
      {children}
    </div>
  );
}

function BreakdownTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="border border-ink/10">
      <div className="font-mono text-[10px] tracking-widish text-ink-3 px-3 py-2 bg-cream-2 border-b border-ink/10 font-semibold">
        {title}
      </div>
      <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
        <table className="w-full text-left border-collapse font-sans text-[10.5px]">
          <thead className="sticky top-0 bg-stepper text-cream font-mono text-[9px] uppercase">
            <tr>
              {headers.map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-ink/10 even:bg-cream-2/40">
                {row.map((cell, j) => (
                  <td key={j} className={`p-2 ${j > 0 ? "font-mono text-right text-ink-2" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HallazgosTable({
  rows,
  statuses,
}: {
  rows: Hallazgo[];
  statuses: Record<number, string>;
}) {
  return (
    <div className="overflow-x-auto border border-ink/10 max-h-[480px] overflow-y-auto">
      <table className="w-full text-left border-collapse font-sans text-[10.5px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-stepper text-cream font-mono text-[9px] uppercase tracking-wide2">
            <th className="p-2">#</th>
            <th className="p-2">Sev.</th>
            <th className="p-2 min-w-[140px]">Producto</th>
            <th className="p-2">Categoría</th>
            <th className="p-2">Almacén</th>
            <th className="p-2 text-right">Impacto</th>
            <th className="p-2 text-right">Z</th>
            <th className="p-2 text-right">Score</th>
            <th className="p-2 text-right">Merma</th>
            <th className="p-2">Rec.</th>
            <th className="p-2">Estatus</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={h.idinventariomesdetalle} className="border-t border-ink/10 even:bg-cream-2/40">
              <td className="p-2 font-mono text-ink-3">{i + 1}</td>
              <td className="p-2">
                <SeverityBadge level={h.severity_label} />
              </td>
              <td className="p-2 font-medium max-w-[200px] truncate" title={h.producto_nombre}>
                {h.producto_nombre}
              </td>
              <td className="p-2 text-ink-2 max-w-[120px] truncate">{h.categoria_nombre}</td>
              <td className="p-2 text-ink-2 max-w-[100px] truncate">{h.almacen_nombre}</td>
              <td className="p-2 font-mono text-right">{mxn(h.financial_impact_mxn)}</td>
              <td className="p-2 font-mono text-right">{h.z_score?.toFixed(2) ?? "—"}</td>
              <td className="p-2 font-mono text-right">{h.score_ponderado.toFixed(1)}</td>
              <td className="p-2 font-mono text-right">
                {h.merma_rate != null ? pct(h.merma_rate, true) : "—"}
              </td>
              <td className="p-2 font-mono text-ink-3">{h.recurrence_count}/4</td>
              <td className="p-2 font-mono text-[10px] capitalize">
                {statuses[h.idinventariomesdetalle] ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
