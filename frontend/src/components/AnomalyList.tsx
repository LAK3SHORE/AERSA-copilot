import type { AnomalyRecord, SeverityLabel } from "../types";
import { fmtMxn, fmtPct, fmtZ } from "../lib/format";

const SEVERITY_BAR: Record<SeverityLabel, string> = {
  CRÍTICO: "bg-crit",
  ALTO: "bg-alto",
  MEDIO: "bg-medio",
  BAJO: "bg-bajo",
};

const SEVERITY_TEXT: Record<SeverityLabel, string> = {
  CRÍTICO: "text-crit",
  ALTO: "text-alto",
  MEDIO: "text-medio",
  BAJO: "text-bajo",
};

interface Props {
  anomalies: AnomalyRecord[];
  total: number;
  onPick: (a: AnomalyRecord) => void;
  selectedId: number | null;
}

export function AnomalyList({ anomalies, total, onPick, selectedId }: Props) {
  return (
    <section className="flex-1 flex flex-col min-h-0">
      <div className="px-7 py-5 border-b hairline flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="label-eyebrow">Hallazgos Priorizados</span>
          <span className="font-mono text-[10px] text-ink-400">
            top {anomalies.length} / {total}
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-widish text-ink-500">§ 03</span>
      </div>

      <ol className="flex-1 overflow-y-auto">
        {anomalies.map((a, i) => {
          const selected = a.idinventariomesdetalle === selectedId;
          return (
            <li
              key={a.idinventariomesdetalle}
              className={`relative group cursor-pointer border-b hairline transition-colors ${
                selected ? "bg-amber-500/10" : "hover:bg-ink-800/50"
              }`}
              onClick={() => onPick(a)}
            >
              <span className={`severity-bar ${SEVERITY_BAR[a.severity_label]}`} />

              <div className="pl-5 pr-7 py-4 flex items-start gap-4">
                <span className="num text-[10px] text-ink-500 mt-1 w-6 shrink-0 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wide2 ${
                        SEVERITY_TEXT[a.severity_label]
                      }`}
                    >
                      {a.severity_label}
                    </span>
                    <span className="num text-[10px] text-ink-400">
                      score {a.priority_score.toFixed(1)}
                    </span>
                    <span className="num text-[10px] text-ink-400">{fmtZ(a.z_score)}</span>
                    {a.recurrence_count > 0 && (
                      <span className="font-mono text-[10px] text-ink-300">
                        recurrencia {a.recurrence_count}/4
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1 font-display text-lg leading-tight text-ink-50 truncate">
                    {a.producto_nombre}
                  </h3>

                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-ink-300 truncate">
                    <span className="truncate">{a.almacen_nombre}</span>
                    <span className="text-ink-600">·</span>
                    <span className="truncate">{a.categoria_nombre}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="num text-base text-ink-50 tabular-nums">
                    {fmtMxn(a.financial_impact_mxn)}
                  </div>
                  <div className="num text-[11px] text-ink-300 mt-0.5">
                    merma {fmtPct(a.merma_rate)}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {anomalies.length === 0 && (
          <li className="px-7 py-12 text-center font-mono text-[11px] text-ink-400">
            Sin hallazgos para este Cierre.
          </li>
        )}
      </ol>
    </section>
  );
}
