import type { KPISummary } from "../types";
import { fmtInt, fmtMxn, fmtMxnCompact, fmtPct } from "../lib/format";

export function KPICards({ kpis, totalAnomalies }: { kpis: KPISummary; totalAnomalies: number }) {
  return (
    <section className="px-7 py-6 border-b hairline space-y-5">
      <div className="flex items-baseline justify-between">
        <span className="label-eyebrow">Indicadores Clave</span>
        <span className="font-mono text-[10px] tracking-widish text-ink-500">§ 02</span>
      </div>

      {/* Marquee — total faltantes presented as the headline number */}
      <div className="border hairline-strong p-5 bg-ink-800/40 relative">
        <span className="absolute top-0 right-0 px-2 py-1 font-mono text-[9px] tracking-wide2 text-amber-400 border-l border-b hairline-strong">
          FALTANTE TOTAL
        </span>
        <div className="num text-3xl md:text-4xl font-medium tabular-nums text-ink-50 leading-tight">
          {fmtMxn(kpis.total_faltantes_mxn)}
        </div>
        <div className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widish text-ink-300">
          <span>{fmtInt(totalAnomalies)} anomalías detectadas</span>
          <span className="text-ink-600">·</span>
          <span>{fmtPct(kpis.pct_lineas_con_merma)} líneas con merma</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Almacenes" value={fmtInt(kpis.num_almacenes)} />
        <Tile label="Productos" value={fmtInt(kpis.num_productos)} />
        <Tile label="Líneas" value={fmtInt(kpis.num_lineas)} />
        <Tile label="Sobrantes" value={fmtMxnCompact(kpis.total_sobrantes_mxn)} />
        <Tile
          label="Importe físico"
          value={fmtMxnCompact(kpis.total_importe_fisico_mxn)}
          colSpan={2}
        />
        <Tile
          label="Categoría más afectada"
          value={kpis.top_categoria_faltante}
          mono={false}
          colSpan={2}
        />
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  mono = true,
  colSpan = 1,
}: {
  label: string;
  value: string;
  mono?: boolean;
  colSpan?: 1 | 2;
}) {
  return (
    <div
      className={`border hairline px-3 py-3 bg-ink-900/60 hover:bg-ink-800/60 transition-colors ${
        colSpan === 2 ? "col-span-2" : ""
      }`}
    >
      <div className="label-eyebrow truncate">{label}</div>
      <div
        className={`mt-1 ${mono ? "num" : "font-display italic"} text-ink-50 ${
          mono ? "text-base tabular-nums" : "text-[15px] leading-snug"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
