import type { FindingStatus, Hallazgo } from "../../types/cierre";
import type { OpenChatFn } from "../../lib/chatTypes";
import {
  contextFromHallazgo,
  displayPromptForFinding,
} from "../../lib/findingPrompt";
import { mxn } from "../../lib/fmt";
import { SeverityBadge } from "../shared/SeverityBadge";
import { EstatusSelect } from "../shared/EstatusSelect";

const SEV_COLOR: Record<string, string> = {
  CRÍTICO: "#B83025",
  ALTO: "#C26020",
  MEDIO: "#9C7E10",
  BAJO: "#5E7B5A",
};

export function FindingCard({
  h,
  estatus,
  onEstatusChange,
  openChat,
  isAdmin,
}: {
  h: Hallazgo;
  estatus: FindingStatus;
  onEstatusChange?: (id: number, s: FindingStatus) => void;
  openChat: OpenChatFn;
  isAdmin?: boolean;
}) {
  const col = SEV_COLOR[h.severity_label] ?? SEV_COLOR.BAJO;
  const mermaPct = h.merma_rate != null ? h.merma_rate * 100 : 0;
  const recLabel = `${h.recurrence_count}/4`;

  return (
    <button
      type="button"
      onClick={() =>
        openChat(displayPromptForFinding(h.producto_nombre, h.almacen_nombre), "audit", {
          findingContext: contextFromHallazgo(h),
        })
      }
      className="w-full text-left mb-2 p-3.5 cursor-pointer bg-cream-2 hover:bg-accent/5 transition-colors border border-ink/10"
      style={{ borderLeftWidth: 3, borderLeftColor: col }}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SeverityBadge level={h.severity_label} />
          <span className="font-sans text-sm font-medium truncate">{h.producto_nombre}</span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 ml-2">
          <div className="text-right">
            <div className="font-mono text-[8.5px] text-ink-4 tracking-widish mb-0.5 whitespace-nowrap">
              SCORE POND.
            </div>
            <div className="font-mono text-sm font-semibold text-accent">
              {h.score_ponderado.toFixed(1)}
            </div>
          </div>
          {!isAdmin && onEstatusChange && (
            <EstatusSelect
              value={estatus}
              onChange={(v) => onEstatusChange(h.idinventariomesdetalle, v)}
            />
          )}
        </div>
      </div>

      <div className="font-mono text-[10px] text-ink-3 tracking-widish mb-3">
        {h.almacen_nombre} · {h.categoria_nombre} · z=
        {h.z_score?.toFixed(2) ?? "—"} · recurrencia {recLabel}
      </div>

      <div className="grid grid-cols-3 gap-4 pb-3 mb-3 border-b border-accent-3">
        {[
          { label: "STOCK FÍSICO", val: h.stock_fisico.toFixed(2), red: false },
          { label: "STOCK TEÓRICO", val: h.stock_teorico.toFixed(2), red: false },
          {
            label: "Δ DIFERENCIA",
            val: (h.delta >= 0 ? "+" : "") + h.delta.toFixed(2),
            red: h.delta < 0,
          },
        ].map((col2) => (
          <div key={col2.label}>
            <div className="font-mono text-[8.5px] tracking-widish text-ink-5 mb-0.5">
              {col2.label}
            </div>
            <div
              className="font-mono text-sm font-medium"
              style={{ color: col2.red ? "#B83025" : undefined }}
            >
              {col2.val}
            </div>
          </div>
        ))}
      </div>

      <div className="flex">
        <div className="flex-1 bg-crit/10 border border-crit/20 px-3.5 py-2">
          <div className="font-mono text-[8.5px] tracking-widish text-crit/70 mb-0.5">
            IMPACTO MONETARIO
          </div>
          <div className="font-mono text-lg font-semibold text-crit tracking-tight">
            {mxn(h.financial_impact_mxn)}
          </div>
        </div>
        <div className="w-[120px] bg-alto/10 border border-alto/20 border-l-0 px-3.5 py-2">
          <div className="font-mono text-[8.5px] tracking-widish text-alto/70 mb-0.5">MERMA</div>
          <div className="font-mono text-lg font-semibold text-alto tracking-tight">
            {mermaPct.toFixed(1)}%
          </div>
        </div>
      </div>
    </button>
  );
}
