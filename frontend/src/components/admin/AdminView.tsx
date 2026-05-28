import { useEffect, useState } from "react";
import { fetchCompanies } from "../../api/companies";
import { fetchPeriods } from "../../api/periods";
import type { AppShellContext } from "../AppShell";
import type { Company } from "../../types";
import { Eyebrow } from "../shared/Eyebrow";
import { AuditorView } from "../auditor/AuditorView";
import { DatosRaw } from "./DatosRaw";
import { PanelAdopcion } from "./PanelAdopcion";

type Tab = "auditor" | "adopcion" | "raw";

export function AdminView({ shell }: { shell: AppShellContext }) {
  const [tab, setTab] = useState<Tab>("adopcion");
  const [adminEmpresa, setAdminEmpresa] = useState<number | null>(null);
  const [adminPeriodo, setAdminPeriodo] = useState<string | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    fetchCompanies(20)
      .then((rows) => {
        setCompanies(rows);
        if (rows[0]) setAdminEmpresa(rows[0].idempresa);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (adminEmpresa == null) return;
    fetchPeriods(adminEmpresa)
      .then((p) => {
        setPeriods(p);
        setAdminPeriodo(p[1] ?? p[0] ?? null);
      })
      .catch(() => setPeriods([]));
  }, [adminEmpresa]);

  const handleTab = (t: Tab) => {
    setTab(t);
    shell.setChatMode(t === "raw" ? "sql" : "analytics");
  };

  const empresaSelector = (
    <div className="flex items-center gap-2 flex-wrap">
      <Eyebrow className="!text-cream/80 mr-1">Empresa</Eyebrow>
      <select
        value={adminEmpresa ?? ""}
        onChange={(e) => setAdminEmpresa(Number(e.target.value))}
        className="font-mono text-[11px] px-1.5 py-0.5 border border-accent-3 bg-cream-2 text-ink outline-none cursor-pointer"
      >
        {companies.map((e) => (
          <option key={e.idempresa} value={e.idempresa}>
            {e.nombre}
          </option>
        ))}
      </select>
      <select
        value={adminPeriodo ?? ""}
        onChange={(e) => setAdminPeriodo(e.target.value)}
        className="font-mono text-[11px] px-1.5 py-0.5 border border-accent-3 bg-cream-2 text-ink outline-none cursor-pointer"
      >
        {periods.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={adminEmpresa == null || !adminPeriodo}
        onClick={() => setLoadKey((k) => k + 1)}
        className="font-mono text-[10px] px-2 py-0.5 bg-accent text-ink border-0 cursor-pointer disabled:opacity-40"
      >
        CARGAR
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="border-b-2 border-accent shrink-0 px-7 flex bg-stepper">
        {(
          [
            { id: "auditor" as const, label: "Vista Auditor" },
            { id: "adopcion" as const, label: "Panel de Adopción" },
            { id: "raw" as const, label: "Datos Raw" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTab(t.id)}
            className={`px-4 py-2.5 bg-transparent border-0 border-b-2 -mb-px cursor-pointer ${
              tab === t.id ? "border-accent" : "border-transparent"
            }`}
          >
            <span
              className={`font-sans text-[12.5px] tracking-tight ${
                tab === t.id ? "font-medium text-cream" : "text-cream/55"
              }`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "auditor" && (
          <AuditorView
            shell={shell}
            isAdmin
            adminEmpresa={adminEmpresa}
            adminPeriodo={adminPeriodo}
            loadKey={loadKey}
            empresaSelector={empresaSelector}
          />
        )}
        {tab === "adopcion" && <PanelAdopcion openChat={shell.openChat} />}
        {tab === "raw" && <DatosRaw shell={shell} />}
      </div>
    </div>
  );
}
