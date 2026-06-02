import type { CierreReport } from "../../types/cierre";
import type { OpenChatFn } from "../../lib/chatTypes";
import { mxn, num, pct, short } from "../../lib/fmt";
import { Section } from "../shared/Section";

export function KPIsSection({
  report,
  openChat,
}: {
  report: CierreReport;
  openChat: OpenChatFn;
}) {
  const c = report.kpis;
  const kpiPrompt = `Dame un resumen ejecutivo del cierre ${report.periodo}: faltante total, distribución por categoría y qué almacenes tienen más impacto.`;
  const tiles = [
    { label: "ALMACENES", val: String(c.num_almacenes) },
    { label: "PRODUCTOS", val: num(c.num_productos) },
    { label: "LÍNEAS", val: num(c.num_lineas) },
    { label: "SOBRANTES", val: short(c.total_sobrantes_mxn) },
    { label: "IMPORTE", val: short(c.total_importe_fisico_mxn) },
  ];

  return (
    <Section num={1} label="Indicadores Clave" className="!mb-5">
      <div
        className="border border-accent-3 p-4"
        style={{ backgroundColor: "rgb(208, 219, 151)" }}
      >
        <div className="flex items-end justify-between mb-2.5">
          <div>
            <div className="font-mono text-[9.5px] tracking-widish text-ink mb-1.5">
              FALTANTE TOTAL · {report.periodo} · {report.idempresa}
            </div>
            <button
              type="button"
              onClick={() => openChat(kpiPrompt, "audit")}
              className="font-mono text-[32px] font-semibold tracking-tight leading-none text-ink cursor-pointer bg-transparent border-0 p-0 text-left"
            >
              {mxn(c.total_faltantes_mxn)}
            </button>
          </div>
          <div className="font-mono text-[10px] text-ink-3 text-right leading-relaxed">
            <div className="font-semibold">{num(report.total_anomalies_found)} ANOMALÍAS</div>
            <div className="font-semibold">{pct(c.pct_lineas_con_merma, true)} CON MERMA</div>
            <div className="text-alto font-bold">{c.top_categoria_faltante}</div>
          </div>
        </div>
        <div className="grid grid-cols-5 border-t border-accent/10 mt-0.5">
          {tiles.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => openChat(kpiPrompt, "audit")}
              className="px-3 py-2.5 text-left border-r border-accent-3 last:border-r-0 bg-cream-2 hover:bg-black/5 cursor-pointer border-t-[3px] border-t-accent transition-colors"
            >
              <div className="font-mono text-[9px] tracking-widish text-ink-3 mb-1 font-semibold">
                {t.label}
              </div>
              <div className="font-mono text-[15px] font-medium">{t.val}</div>
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
