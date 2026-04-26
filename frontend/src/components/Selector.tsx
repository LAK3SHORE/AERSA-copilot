import { useEffect, useState } from "react";
import type { Company } from "../types";
import { fetchCompanies } from "../api/companies";
import { fetchPeriods } from "../api/periods";
import { fmtInt, fmtPeriodo } from "../lib/format";

interface Props {
  idempresa: number | null;
  periodo: string | null;
  onPick: (idempresa: number, periodo: string) => void;
  loading: boolean;
}

export function Selector({ idempresa, periodo, onPick, loading }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [draftEmpresa, setDraftEmpresa] = useState<number | null>(idempresa);
  const [draftPeriodo, setDraftPeriodo] = useState<string | null>(periodo);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies(8)
      .then((rows) => {
        setCompanies(rows);
        if (!draftEmpresa && rows[0]) setDraftEmpresa(rows[0].idempresa);
      })
      .catch((e) => setErr(`No se pudo cargar empresas: ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (draftEmpresa == null) return;
    fetchPeriods(draftEmpresa)
      .then((p) => {
        setPeriods(p);
        if (!draftPeriodo || !p.includes(draftPeriodo)) {
          // pick the latest *finalizado* period (heuristic: 2nd most recent
          // is usually a closed cierre vs current in-progress).
          setDraftPeriodo(p[1] ?? p[0] ?? null);
        }
      })
      .catch((e) => setErr(`No se pudo cargar periodos: ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftEmpresa]);

  const canLoad = draftEmpresa != null && draftPeriodo != null && !loading;

  return (
    <section className="relative">
      <div className="space-y-3.5 px-7 py-4 border-b hairline">
        <div className="flex items-center justify-between">
          <span className="label-eyebrow">Sesión de Auditoría</span>
          <span className="font-mono text-[10px] tracking-widish text-ink-4"> 01</span>
        </div>

        <SelectField label="Empresa">
          <select
            value={draftEmpresa ?? ""}
            disabled={loading}
            onChange={(e) => setDraftEmpresa(Number(e.target.value))}
            className="w-full appearance-none bg-transparent border-b hairline-strong pb-1.5 pt-0.5 text-[15px] font-sans font-medium tracking-tight text-ink outline-none focus:border-accent disabled:opacity-50"
          >
            {companies.map((c) => (
              <option key={c.idempresa} value={c.idempresa} className="bg-cream text-ink">
                {c.nombre} — {fmtInt(c.num_inventarios)} inv
              </option>
            ))}
          </select>
        </SelectField>

        <SelectField label="Periodo">
          <select
            value={draftPeriodo ?? ""}
            disabled={loading || periods.length === 0}
            onChange={(e) => setDraftPeriodo(e.target.value)}
            className="w-full appearance-none bg-transparent border-b hairline-strong pb-1.5 pt-0.5 text-[15px] font-sans font-medium tracking-tight text-ink outline-none focus:border-accent disabled:opacity-50"
          >
            {periods.map((p) => (
              <option key={p} value={p} className="bg-cream text-ink">
                {fmtPeriodo(p)} · {p}
              </option>
            ))}
          </select>
        </SelectField>

        <button
          disabled={!canLoad}
          onClick={() => canLoad && onPick(draftEmpresa!, draftPeriodo!)}
          className="group relative w-full overflow-hidden border hairline-strong bg-cream-2 px-5 py-2.5 text-left transition-all hover:border-accent hover:bg-cream-3 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="absolute inset-y-0 left-0 w-[3px] bg-accent transition-all group-hover:w-2" />
          <div className="flex items-center justify-between pl-2">
            <span className="font-mono text-[11px] uppercase tracking-wide2 text-ink-2">
              {loading ? "Generando análisis…" : "Cargar Cierre"}
            </span>
            <span className="font-mono text-[11px] text-accent">
              {loading ? "··· " : "→"}
            </span>
          </div>
        </button>

        {err && <p className="font-mono text-[11px] text-crit">{err}</p>}
      </div>
    </section>
  );
}

function SelectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label-eyebrow block mb-0.5">{label}</span>
      {children}
    </div>
  );
}
