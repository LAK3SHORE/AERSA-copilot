import { useMemo } from "react";
import type { Hallazgo, SeverityLabel } from "../../types/cierre";

export interface FindingFilters {
  severities: Set<SeverityLabel | "TODOS">;
  estatus: string;
  cat: string;
  almacen: string;
  minMxn: number;
  minMerma: number;
  minZ: number;
  minScore: number;
}

export const DEFAULT_FILTERS: FindingFilters = {
  severities: new Set(["TODOS"]),
  estatus: "TODOS",
  cat: "TODAS",
  almacen: "TODOS",
  minMxn: 0,
  minMerma: 0,
  minZ: 0,
  minScore: 0,
};

const PRESETS = {
  minMxn: [
    { label: "todos", val: 0 },
    { label: "≥$500", val: 500 },
    { label: "≥$1K", val: 1000 },
    { label: "≥$2K", val: 2000 },
  ],
  minMerma: [
    { label: "todos", val: 0 },
    { label: "≥25%", val: 25 },
    { label: "≥50%", val: 50 },
    { label: "≥100%", val: 100 },
  ],
  minZ: [
    { label: "todos", val: 0 },
    { label: "≥2", val: 2 },
    { label: "≥5", val: 5 },
    { label: "≥10", val: 10 },
  ],
  minScore: [
    { label: "todos", val: 0 },
    { label: "≥20", val: 20 },
    { label: "≥40", val: 40 },
    { label: "≥50", val: 50 },
  ],
} as const;

const CHIP_LABELS: Record<keyof typeof PRESETS, string> = {
  minMxn: "PÉRDIDA MXN",
  minMerma: "MERMA %",
  minZ: "Z-SCORE",
  minScore: "SCORE POND.",
};

const SEV_OPTIONS: (SeverityLabel | "TODOS")[] = [
  "TODOS",
  "CRÍTICO",
  "ALTO",
  "MEDIO",
  "BAJO",
];

export function FilterBar({
  filters,
  hallazgos,
  onChange,
}: {
  filters: FindingFilters;
  hallazgos: Hallazgo[];
  onChange: (key: string, val: unknown) => void;
}) {
  const cats = useMemo(
    () => ["TODAS", ...new Set(hallazgos.map((h) => h.categoria_nombre))],
    [hallazgos],
  );
  const almacenes = useMemo(
    () => ["TODOS", ...new Set(hallazgos.map((h) => h.almacen_nombre))],
    [hallazgos],
  );

  const selClass =
    "font-mono text-[10px] tracking-widish px-2 py-1 border border-accent-3 bg-cream-2 text-ink outline-none cursor-pointer";

  const hasActive =
    !filters.severities.has("TODOS") ||
    filters.estatus !== "TODOS" ||
    filters.cat !== "TODAS" ||
    filters.almacen !== "TODOS" ||
    filters.minMxn > 0 ||
    filters.minMerma > 0 ||
    filters.minZ > 0 ||
    filters.minScore > 0;

  const toggleSev = (s: SeverityLabel | "TODOS") => {
    if (s === "TODOS") {
      onChange("severities", new Set(["TODOS"]));
      return;
    }
    const next = new Set(filters.severities);
    next.delete("TODOS");
    if (next.has(s)) next.delete(s);
    else next.add(s);
    if (next.size === 0) next.add("TODOS");
    onChange("severities", next);
  };

  return (
    <div className="px-7 py-2.5 border-b border-accent-2/25 bg-black/5 flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] tracking-widish text-ink-3">SEVERIDAD</span>
        <div className="flex flex-wrap gap-1">
          {SEV_OPTIONS.map((s) => {
            const active = filters.severities.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSev(s)}
                className={`font-mono text-[10px] px-2 py-0.5 border cursor-pointer transition-colors ${
                  active
                    ? "bg-accent text-cream-2 border-accent"
                    : "bg-transparent border-accent-3 text-ink-3"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] tracking-widish text-ink-3">ESTATUS</span>
        <select
          value={filters.estatus}
          onChange={(e) => onChange("estatus", e.target.value)}
          className={selClass}
        >
          {["TODOS", "PENDIENTE", "REVISADO", "ESCALADO"].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] tracking-widish text-ink-3">CATEGORÍA</span>
        <select
          value={filters.cat}
          onChange={(e) => onChange("cat", e.target.value)}
          className={selClass}
        >
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] tracking-widish text-ink-3">ALMACÉN</span>
        <select
          value={filters.almacen}
          onChange={(e) => onChange("almacen", e.target.value)}
          className={selClass}
        >
          {almacenes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="w-px h-9 bg-accent-3 shrink-0" />

      {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((id) => (
        <div key={id} className="flex flex-col gap-1">
          <span className="font-mono text-[9px] tracking-widish text-ink-3">
            {CHIP_LABELS[id]}
          </span>
          <div className="flex gap-0.5">
            {PRESETS[id].map((p) => {
              const active = filters[id] === p.val;
              return (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => onChange(id, p.val)}
                  className={`font-mono text-[10px] px-2 py-0.5 border whitespace-nowrap cursor-pointer transition-colors ${
                    active
                      ? "bg-accent text-cream-2 border-accent"
                      : "bg-transparent border-accent-3 text-ink-3"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {hasActive && (
        <button
          type="button"
          onClick={() => onChange("__reset__", null)}
          className="font-mono text-[9.5px] px-2.5 py-1 border border-accent-3 text-ink-3 hover:bg-accent/10 hover:text-ink self-end cursor-pointer"
        >
          × limpiar
        </button>
      )}
    </div>
  );
}

export function applyFilters(
  hallazgos: Hallazgo[],
  filters: FindingFilters,
  estatusMap: Record<number, string>,
): Hallazgo[] {
  return hallazgos.filter((h) => {
    if (!filters.severities.has("TODOS") && !filters.severities.has(h.severity_label)) {
      return false;
    }
    const est = (estatusMap[h.idinventariomesdetalle] ?? "pendiente").toUpperCase();
    if (filters.estatus !== "TODOS" && est !== filters.estatus) return false;
    if (filters.cat !== "TODAS" && h.categoria_nombre !== filters.cat) return false;
    if (filters.almacen !== "TODOS" && h.almacen_nombre !== filters.almacen) return false;
    if (h.financial_impact_mxn < filters.minMxn) return false;
    const merma = (h.merma_rate ?? 0) * 100;
    if (merma < filters.minMerma) return false;
    if ((h.z_score ?? 0) < filters.minZ) return false;
    if (h.score_ponderado < filters.minScore) return false;
    return true;
  });
}
