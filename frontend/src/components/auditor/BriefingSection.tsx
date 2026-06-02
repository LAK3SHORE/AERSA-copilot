import type { AuditBrief, CierreReport } from "../../types/cierre";
import type { OpenChatFn } from "../../lib/chatTypes";
import {
  contextFromBriefAction,
  displayPromptForFinding,
} from "../../lib/findingPrompt";
import { mxn, num, pct } from "../../lib/fmt";
import { Section } from "../shared/Section";
import { SeverityBadge } from "../shared/SeverityBadge";

export function BriefingSection({
  report,
  brief,
  loading,
  openChat,
}: {
  report: CierreReport;
  brief: AuditBrief | null;
  loading: boolean;
  openChat: OpenChatFn;
}) {
  const c = report.kpis;
  const briefingPrompt = `El faltante total de este Cierre asciende a ${c.total_faltantes_mxn.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN, con ${report.total_anomalies_found} anomalías detectadas y la categoría "${c.top_categoria_faltante}" como la más afectada. ¿Cómo se distribuye este faltante entre categorías y almacenes, qué hallazgos lo explican, y qué debería revisar primero?`;

  return (
    <Section num={2} label="¿Por dónde empiezo?">
      <button
        type="button"
        onClick={() => openChat(briefingPrompt, "audit")}
        className="w-full text-left bg-white border border-accent-2/30 border-l-[3px] border-l-accent-2 p-3.5 mb-2.5 hover:bg-accent-2/10 transition-colors"
      >
        <div className="font-mono text-[10px] text-ink-3 mb-1 tracking-widish">
          FALTANTE TOTAL · {report.total_anomalies_found} ANOMALÍAS
        </div>
        <div className="font-mono text-[15px] font-semibold text-ink mb-1 tracking-tight">
          Faltante total {mxn(c.total_faltantes_mxn)} · {report.total_anomalies_found} anomalías
        </div>
        <div className="font-sans text-[11.5px] text-ink-2 leading-snug">
          Cierre {report.periodo} con {c.num_almacenes} almacenes y {num(c.num_lineas)} líneas.{" "}
          {pct(c.pct_lineas_con_merma, true)} de líneas con merma. La categoría con mayor faltante
          es <strong>{c.top_categoria_faltante}</strong>.
        </div>
      </button>

      {loading && (
        <p className="font-mono text-[10px] text-ink-4 animate-blink">Cargando acciones…</p>
      )}
      <div className="flex flex-col gap-1.5">
        {(brief?.actions ?? []).map((a, i) => (
          <button
            key={a.idinventariomesdetalle}
            type="button"
            onClick={() =>
              openChat(displayPromptForFinding(a.producto_nombre, a.almacen_nombre), "audit", {
                findingContext: contextFromBriefAction(a),
              })
            }
            className="flex items-start gap-2.5 p-2.5 border border-accent-2/25 bg-white hover:bg-accent-2/10 cursor-pointer text-left transition-colors"
          >
            <span className="font-mono text-[9.5px] text-ink-3 mt-0.5 shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <SeverityBadge level={a.severity_label} />
                <span className="font-sans text-[13px] font-medium text-ink">{a.title}</span>
              </div>
              <div className="font-mono text-[10px] text-ink-3 tracking-widish">{a.reason}</div>
            </div>
            <span className="font-mono text-[10px] text-accent shrink-0">›</span>
          </button>
        ))}
      </div>
    </Section>
  );
}
