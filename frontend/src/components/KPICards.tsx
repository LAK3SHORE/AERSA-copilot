import type { KPISummary } from "../types";
import { fmtInt, fmtMxn, fmtMxnCompact, fmtPct } from "../lib/format";

interface Props {
  kpis: KPISummary;
  totalAnomalies: number;
  onAsk: (prompt: string) => void;
}

export function KPICards({ kpis, totalAnomalies, onAsk }: Props) {
  const faltanteTotal = fmtMxn(kpis.total_faltantes_mxn);
  const sobrantes = fmtMxn(kpis.total_sobrantes_mxn);
  const importeFisico = fmtMxn(kpis.total_importe_fisico_mxn);
  const pctMerma = fmtPct(kpis.pct_lineas_con_merma);
  const topCat = kpis.top_categoria_faltante;

  const askFaltante = () =>
    onAsk(
      `El faltante total de este Cierre asciende a ${faltanteTotal} MXN, con ${fmtInt(totalAnomalies)} anomalías detectadas y la categoría "${topCat}" como la más afectada. ¿Cómo se distribuye este faltante entre categorías y almacenes, qué hallazgos lo explican, y qué debería revisar primero para mitigarlo?`,
    );

  const askAlmacenes = () =>
    onAsk(
      `Hay ${fmtInt(kpis.num_almacenes)} almacenes activos en este Cierre. ¿Cuáles concentran la mayor parte del faltante y qué tan parejo o desigual está distribuido el problema entre ellos?`,
    );

  const askProductos = () =>
    onAsk(
      `Se analizaron ${fmtInt(kpis.num_productos)} productos distintos en este Cierre. ¿Qué tipos de producto presentan mayor merma, cuáles son los más impactantes financieramente y qué subset deberíamos auditar primero?`,
    );

  const askLineas = () =>
    onAsk(
      `Tenemos ${fmtInt(kpis.num_lineas)} líneas de inventario en este Cierre y ${pctMerma} de ellas presentan merma. ¿Cómo se concentra estadísticamente esta merma y qué líneas son las más críticas?`,
    );

  const askSobrantes = () =>
    onAsk(
      `Aparecen ${sobrantes} MXN de sobrantes (stock físico mayor al teórico) en este Cierre. ¿Qué pueden indicar estos sobrantes, dónde se concentran y deberíamos investigarlos como parte de la auditoría?`,
    );

  const askImporte = () =>
    onAsk(
      `El importe físico total de este Cierre es ${importeFisico} MXN. ¿Cómo se compone por categorías y qué proporción representa la merma sobre este total?`,
    );

  return (
    <section className="px-7 py-4 border-b hairline space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="label-eyebrow">Indicadores Clave</span>
        <span className="font-mono text-[10px] tracking-widish text-ink-4"> 02</span>
      </div>

      {/* Marquee — total faltantes presented as the headline number, click to ask */}
      <button
        type="button"
        onClick={askFaltante}
        className="group block w-full text-left border hairline-strong p-3.5 bg-cream-2 hover:bg-cream-3 hover:border-accent transition-colors relative cursor-pointer"
      >
        <span className="absolute top-0 right-0 px-2 py-1 font-mono text-[9px] tracking-wide2 text-accent border-l border-b hairline-strong">
          FALTANTE TOTAL
        </span>
        <div className="num text-2xl md:text-[26px] font-medium tabular-nums text-ink leading-tight">
          {faltanteTotal}
        </div>
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widish text-ink-3 flex-wrap">
          <span>{fmtInt(totalAnomalies)} anomalías</span>
          <span className="text-ink-5">·</span>
          <span>{pctMerma} con merma</span>
          <span className="text-ink-5">·</span>
          <span className="truncate text-ink-2 normal-case tracking-normal">{topCat}</span>
        </div>
        <span className="absolute bottom-1.5 right-2.5 font-mono text-[10px] text-ink-4 opacity-0 group-hover:opacity-100 transition-opacity">
          preguntar →
        </span>
      </button>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Almacenes" value={fmtInt(kpis.num_almacenes)} onAsk={askAlmacenes} />
        <Tile label="Productos" value={fmtInt(kpis.num_productos)} onAsk={askProductos} />
        <Tile label="Líneas" value={fmtInt(kpis.num_lineas)} onAsk={askLineas} />
        <Tile label="Sobrantes" value={fmtMxnCompact(kpis.total_sobrantes_mxn)} onAsk={askSobrantes} />
        <Tile
          label="Importe"
          value={fmtMxnCompact(kpis.total_importe_fisico_mxn)}
          colSpan={2}
          onAsk={askImporte}
        />
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  colSpan = 1,
  onAsk,
}: {
  label: string;
  value: string;
  colSpan?: 1 | 2;
  onAsk: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAsk}
      className={`group text-left border hairline px-2.5 py-2 bg-cream hover:bg-cream-3 hover:border-accent transition-colors cursor-pointer ${
        colSpan === 2 ? "col-span-2" : ""
      }`}
    >
      <div className="label-eyebrow truncate group-hover:text-accent transition-colors">
        {label}
      </div>
      <div className="mt-0.5 num text-[14px] tabular-nums text-ink truncate">{value}</div>
    </button>
  );
}
