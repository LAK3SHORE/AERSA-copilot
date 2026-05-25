import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fetchBrief } from "../api/brief";
import { fetchCierre } from "../api/cierre";
import { updateFindingStatus } from "../api/findings";
import { logSessionEvent, endSession } from "../api/sessions";
import { streamChat } from "../api/chat";
import type {
  AnomalyRecord,
  AuditBrief,
  AuditBriefAction,
  ChatHistoryMessage,
  ChatMessage,
  CierreReport,
  FindingStatus,
  ToolCallIndicator,
} from "../types";
import {
  contextFromAnomaly,
  contextFromBriefAction,
  displayPromptForFinding,
  type FindingContextPayload,
} from "../lib/findingPrompt";
import { Header } from "../components/Header";
import { Selector } from "../components/Selector";
import { KPICards } from "../components/KPICards";
import { AnomalyList } from "../components/AnomalyList";
import { GuidedBriefing } from "../components/GuidedBriefing";
import { ChatPanel } from "../components/ChatPanel";

type Status = "idle" | "loading" | "ready" | "error";

interface Props {
  onOpenAnalytics?: () => void;
  /** When true, hide outer header (parent provides nav) — full auditor UX including briefing. */
  embedded?: boolean;
}

export function AuditorPage({ onOpenAnalytics, embedded }: Props) {
  const { user, logout } = useAuth();
  const lockedEmpresa = user?.role === "auditor" ? user.idempresa : null;

  const [empresa, setEmpresa] = useState<number | null>(lockedEmpresa);
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [report, setReport] = useState<CierreReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [findingStatuses, setFindingStatuses] = useState<Record<number, string>>({});
  const [brief, setBrief] = useState<AuditBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatPending, setChatPending] = useState(false);
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (lockedEmpresa != null) setEmpresa(lockedEmpresa);
  }, [lockedEmpresa]);

  useEffect(() => {
    const sid = sessionId;
    if (sid == null) return;
    const onUnload = () => {
      const dur = Math.round((Date.now() - sessionStartRef.current) / 1000);
      void endSession(sid, dur).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [sessionId]);

  const loadCierre = useCallback(async (id: number, per: string) => {
    setEmpresa(id);
    setPeriodo(per);
    setStatus("loading");
    setLoadError(null);
    setReport(null);
    setBrief(null);
    setMessages([]);
    setSelectedAnomaly(null);
    setSessionId(null);
    sessionStartRef.current = Date.now();

    try {
      const data = await fetchCierre(id, per);
      setReport(data);
      setSessionId(data.audit_session_id ?? null);
      setFindingStatuses(data.finding_statuses ?? {});
      setStatus("ready");

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
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: { suggested?: boolean; findingContext?: FindingContextPayload },
    ) => {
      if (!empresa || !periodo) return;

      const history: ChatHistoryMessage[] = messages
        .filter((m) => !m.pending)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsg: ChatMessage = { role: "user", content: text };
      const pendingAssistant: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [],
        pending: true,
      };

      setMessages((prev) => [...prev, userMsg, pendingAssistant]);
      setChatPending(true);

      const tools: ToolCallIndicator[] = [];
      let buf = "";

      const updateAssistant = (patch: Partial<ChatMessage>) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, ...patch };
          }
          return next;
        });
      };

      try {
        await streamChat(
          {
            idempresa: empresa,
            periodo,
            message: text,
            history,
            session_id: sessionId,
            suggested: opts?.suggested ?? false,
            finding_context: opts?.findingContext ?? null,
          },
          {
            onEvent: (evt) => {
              switch (evt.type) {
                case "token":
                  buf += evt.content;
                  updateAssistant({ content: buf });
                  break;
                case "tool_call":
                  tools.push({
                    name: evt.name,
                    status: "running",
                    arguments: evt.arguments,
                  });
                  updateAssistant({ toolCalls: [...tools] });
                  break;
                case "tool_result": {
                  const t = tools.find((x) => x.name === evt.name && x.status === "running");
                  if (t) t.status = evt.status;
                  updateAssistant({ toolCalls: [...tools] });
                  break;
                }
                case "done":
                  if (evt.content) buf = evt.content;
                  updateAssistant({ content: buf, pending: false });
                  break;
                case "error":
                  updateAssistant({
                    content: `⚠ ${evt.message}`,
                    pending: false,
                  });
                  break;
              }
            },
            onError: (err) => {
              updateAssistant({
                content: `⚠ ${err.message}`,
                pending: false,
              });
            },
          },
        );
      } finally {
        setChatPending(false);
      }
    },
    [empresa, periodo, messages, sessionId],
  );

  const onAnomalyPick = useCallback(
    (a: AnomalyRecord) => {
      setSelectedAnomaly(a.idinventariomesdetalle);
      if (sessionId != null) {
        void logSessionEvent(sessionId, "anomaly_click", {
          idinventariomesdetalle: a.idinventariomesdetalle,
          severity_label: a.severity_label,
        });
      }
      sendMessage(displayPromptForFinding(a.producto_nombre, a.almacen_nombre), {
        findingContext: contextFromAnomaly(a),
      });
    },
    [sendMessage, sessionId],
  );

  const onBriefAction = useCallback(
    (action: AuditBriefAction) => {
      setSelectedAnomaly(action.idinventariomesdetalle);
      sendMessage(
        displayPromptForFinding(action.producto_nombre, action.almacen_nombre),
        { suggested: true, findingContext: contextFromBriefAction(action) },
      );
    },
    [sendMessage],
  );

  const onStatusChange = useCallback(
    async (id: number, status: FindingStatus) => {
      if (!empresa) return;
      setFindingStatuses((prev) => ({ ...prev, [id]: status }));
      try {
        await updateFindingStatus(id, status, {
          sessionId: sessionId ?? undefined,
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
    [empresa, sessionId],
  );

  const handleLogout = useCallback(() => {
    if (sessionId != null) {
      const dur = Math.round((Date.now() - sessionStartRef.current) / 1000);
      void endSession(sessionId, dur);
    }
    logout();
  }, [logout, sessionId]);

  const showFindingStatus = user?.role === "auditor";

  return (
    <div className={`relative z-10 flex flex-col ${embedded ? "h-full" : "h-screen"}`}>
      {!embedded && (
        <Header
          idempresa={empresa}
          periodo={periodo}
          status={status}
          username={user?.username}
          role={user?.role}
          onOpenAnalytics={user?.role === "corporativo" ? onOpenAnalytics : undefined}
          onLogout={handleLogout}
        />
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(380px,40%)_1fr] min-h-0">
        <aside className="border-r hairline flex flex-col min-h-0 overflow-y-auto">
          <Selector
            idempresa={empresa}
            periodo={periodo}
            lockedEmpresa={lockedEmpresa}
            onPick={loadCierre}
            loading={status === "loading"}
          />

          {status === "loading" && <LoadingSkeleton />}
          {status === "error" && (
            <div className="px-7 py-8 font-mono text-[12px] text-crit border-b hairline">
              <p className="label-eyebrow text-crit mb-2">Error al cargar</p>
              {loadError}
            </div>
          )}
          {status === "ready" && report && (
            <>
              <GuidedBriefing
                brief={brief}
                loading={briefLoading}
                onAction={onBriefAction}
              />
              <KPICards
                kpis={report.kpis}
                totalAnomalies={report.total_anomalies_found}
                onAsk={sendMessage}
              />
              <AnomalyList
                anomalies={report.top_anomalies}
                total={report.total_anomalies_found}
                onPick={onAnomalyPick}
                selectedId={selectedAnomaly}
                findingStatuses={findingStatuses}
                onStatusChange={showFindingStatus ? onStatusChange : undefined}
              />
            </>
          )}
          {status === "idle" && <IdleHint />}
        </aside>

        <div className="min-h-0">
          <ChatPanel
            messages={messages}
            pending={chatPending}
            ready={status === "ready"}
            empresa={empresa}
            periodo={periodo}
            onSend={sendMessage}
          />
        </div>
      </main>

      <footer className="border-t hairline px-7 py-2.5 flex items-center justify-between font-mono text-[10px] tracking-widish text-ink-4">
        <span>
          TALOS Copiloto v0.2 · Sessions 10–13
          {sessionId != null && (
            <span className="text-ink-3 ml-2">sesión #{sessionId}</span>
          )}
        </span>
        <span>
          datos read-only · MariaDB <span className="text-ink-3">talos_tecmty</span>
        </span>
      </footer>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-7 py-8 space-y-3 animate-fade-in">
      <p className="label-eyebrow">Generando análisis</p>
      <p className="font-sans font-medium text-xl text-ink leading-tight">
        Calculando z-scores, ranking impacto financiero, ensamblando reporte…
      </p>
      <div className="space-y-2 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 border hairline bg-cream-2 animate-blink"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="font-mono text-[11px] text-ink-4 pt-2">
        Primera carga del periodo: ~5–8s · cache TTL 600s
      </p>
    </div>
  );
}

function IdleHint() {
  return (
    <div className="flex-1 flex items-center justify-center px-7 py-12">
      <div className="text-center max-w-xs space-y-3 animate-fade-in">
        <p className="font-sans font-medium text-lg text-ink-2 leading-snug">
          Cada Cierre cuenta una historia. Ayúdale al auditor a encontrarla.
        </p>
        <p className="font-mono text-[10px] tracking-wide2 uppercase text-ink-4">
          Selecciona arriba para empezar
        </p>
      </div>
    </div>
  );
}
