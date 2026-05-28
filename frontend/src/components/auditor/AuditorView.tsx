import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../auth/AuthContext";
import { fetchBrief } from "../../api/brief";
import { fetchCierre } from "../../api/cierre";
import { updateFindingStatus } from "../../api/findings";
import { endSession } from "../../api/sessions";
import type { AppShellContext } from "../AppShell";
import type { AuditBrief, CierreReport, FindingStatus } from "../../types/cierre";
import { buildToolCatalog } from "../../lib/toolsCatalog";
import { Selector } from "../Selector";
import { Page1 } from "./Page1";
import { Page2 } from "./Page2";
import {
  DEFAULT_FILTERS,
  applyFilters,
  type FindingFilters,
} from "./FilterBar";

type Status = "idle" | "loading" | "ready" | "error";

interface Props {
  shell: AppShellContext;
  isAdmin?: boolean;
  adminEmpresa?: number | null;
  adminPeriodo?: string | null;
  loadKey?: number;
  empresaSelector?: ReactNode;
}

export function AuditorView({
  shell,
  isAdmin = false,
  adminEmpresa,
  adminPeriodo,
  loadKey = 0,
  empresaSelector,
}: Props) {
  const { user } = useAuth();
  const lockedEmpresa = user?.role === "auditor" ? user.idempresa : null;

  const [empresa, setEmpresa] = useState<number | null>(
    isAdmin ? adminEmpresa ?? null : lockedEmpresa,
  );
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [report, setReport] = useState<CierreReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brief, setBrief] = useState<AuditBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [findingStatuses, setFindingStatuses] = useState<Record<number, string>>({});
  const [viewPage, setViewPage] = useState(1);
  const [hallPage, setHallPage] = useState(1);
  const [filters, setFilters] = useState<FindingFilters>(DEFAULT_FILTERS);
  const sessionStartRef = useRef(Date.now());

  useEffect(() => {
    if (isAdmin && adminEmpresa != null) setEmpresa(adminEmpresa);
  }, [isAdmin, adminEmpresa]);

  useEffect(() => {
    if (lockedEmpresa != null) setEmpresa(lockedEmpresa);
  }, [lockedEmpresa]);

  useEffect(() => {
    const sid = shell.sessionId;
    if (sid == null) return;
    const onUnload = () => {
      const dur = Math.round((Date.now() - sessionStartRef.current) / 1000);
      void endSession(sid, dur).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [shell.sessionId]);

  const loadCierre = useCallback(
    async (id: number, per: string) => {
      setEmpresa(id);
      setPeriodo(per);
      setStatus("loading");
      setLoadError(null);
      setReport(null);
      setBrief(null);
      sessionStartRef.current = Date.now();

      try {
        const data = await fetchCierre(id, per, 100);
        setReport(data);
        shell.setCierreContext({
          idempresa: id,
          periodo: per,
          sessionId: data.audit_session_id ?? null,
        });
        setFindingStatuses(data.finding_statuses ?? {});
        setStatus("ready");
        setViewPage(1);
        setHallPage(1);
        setFilters(DEFAULT_FILTERS);

        setBriefLoading(true);
        try {
          const b = await fetchBrief(id, per, data.audit_session_id ?? undefined);
          setBrief(b);
        } finally {
          setBriefLoading(false);
        }
      } catch (e) {
        setStatus("error");
        setLoadError((e as Error).message);
      }
    },
    [shell],
  );

  const onFilterChange = (key: string, val: unknown) => {
    if (key === "__reset__") {
      setFilters(DEFAULT_FILTERS);
      setHallPage(1);
      return;
    }
    setFilters((prev) => ({ ...prev, [key]: val }));
    setHallPage(1);
  };

  const hallazgos = report?.top_anomalies ?? [];
  const filtered = useMemo(
    () => applyFilters(hallazgos, filters, findingStatuses),
    [hallazgos, filters, findingStatuses],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 6));

  const onStatusChange = useCallback(
    async (id: number, st: FindingStatus) => {
      if (!empresa) return;
      setFindingStatuses((prev) => ({ ...prev, [id]: st }));
      try {
        await updateFindingStatus(id, st, {
          sessionId: shell.sessionId ?? undefined,
          idempresa: empresa,
        });
      } catch {
        setFindingStatuses((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [empresa, shell.sessionId],
  );

  const tools = report
    ? buildToolCatalog(report.idempresa, report.periodo)
    : buildToolCatalog(empresa ?? 0, periodo ?? "—");

  const showFindingStatus = user?.role === "auditor" && !isAdmin;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b-2 border-accent shrink-0 px-7 flex items-stretch bg-stepper">
        {empresaSelector && (
          <div className="flex items-center mr-6 pr-6 border-r border-cream/15">
            {empresaSelector}
          </div>
        )}
        {[
          { n: 1, label: "Contexto & Orientación" },
          { n: 2, label: "Hallazgos Priorizados" },
        ].map((tab) => (
          <button
            key={tab.n}
            type="button"
            onClick={() => setViewPage(tab.n)}
            className={`flex items-center gap-1.5 px-4 py-2.5 bg-transparent border-0 border-b-2 -mb-px cursor-pointer transition-colors ${
              viewPage === tab.n ? "border-accent" : "border-transparent"
            }`}
          >
            <span
              className={`font-mono text-[9.5px] tracking-wide2 ${
                viewPage === tab.n ? "text-accent" : "text-cream/40"
              }`}
            >
              0{tab.n}
            </span>
            <span
              className={`font-sans text-[12.5px] tracking-tight ${
                viewPage === tab.n ? "font-medium text-cream" : "text-cream/60"
              }`}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {(status === "idle" || status === "error") && !isAdmin && (
        <div className="border-b border-accent-3">
          <Selector
            idempresa={empresa}
            periodo={periodo}
            lockedEmpresa={lockedEmpresa}
            onPick={loadCierre}
            loading={false}
          />
        </div>
      )}

      {isAdmin && loadKey > 0 && adminEmpresa != null && adminPeriodo && (
        <AdminLoadTrigger
          key={loadKey}
          idempresa={adminEmpresa}
          periodo={adminPeriodo}
          onLoad={loadCierre}
        />
      )}

      {status === "loading" && (
        <div className="px-7 py-8 font-mono text-xs text-ink-3 animate-blink">
          Generando análisis…
        </div>
      )}
      {status === "error" && (
        <div className="px-7 py-6 font-mono text-xs text-crit">{loadError}</div>
      )}

      {status === "ready" && report && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewPage === 1 && (
            <Page1
              report={report}
              brief={brief}
              briefLoading={briefLoading}
              tools={tools}
              openChat={shell.openChat}
            />
          )}
          {viewPage === 2 && (
            <Page2
              filtered={filtered}
              totalCount={hallazgos.length}
              estatusMap={findingStatuses}
              onEstatusChange={showFindingStatus ? onStatusChange : undefined}
              openChat={shell.openChat}
              isAdmin={isAdmin}
              page={hallPage}
              totalPages={totalPages}
              onPageChange={setHallPage}
              filters={filters}
              onFilterChange={onFilterChange}
              allHallazgos={hallazgos}
            />
          )}
        </div>
      )}

      {status === "idle" && !isAdmin && (
        <div className="flex-1 flex items-center justify-center text-ink-4 font-mono text-[10px] tracking-widish">
          Selecciona empresa y período para empezar
        </div>
      )}
      {status === "idle" && isAdmin && (
        <div className="flex-1 flex items-center justify-center text-ink-4 font-mono text-[10px] tracking-widish">
          Elige empresa, período y pulsa CARGAR
        </div>
      )}
    </div>
  );
}

function AdminLoadTrigger({
  idempresa,
  periodo,
  onLoad,
}: {
  idempresa: number;
  periodo: string;
  onLoad: (id: number, per: string) => void;
}) {
  useEffect(() => {
    onLoad(idempresa, periodo);
  }, [idempresa, periodo, onLoad]);
  return null;
}
