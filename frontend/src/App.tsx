import { useCallback, useState } from "react";
import { fetchCierre } from "./api/cierre";
import { streamChat } from "./api/chat";
import type {
  AnomalyRecord,
  ChatHistoryMessage,
  ChatMessage,
  CierreReport,
  ToolCallIndicator,
} from "./types";
import { Header } from "./components/Header";
import { Selector } from "./components/Selector";
import { KPICards } from "./components/KPICards";
import { AnomalyList } from "./components/AnomalyList";
import { ChatPanel } from "./components/ChatPanel";

type Status = "idle" | "loading" | "ready" | "error";

export default function App() {
  const [empresa, setEmpresa] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [report, setReport] = useState<CierreReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<number | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatPending, setChatPending] = useState(false);

  const loadCierre = useCallback(async (id: number, per: string) => {
    setEmpresa(id);
    setPeriodo(per);
    setStatus("loading");
    setLoadError(null);
    setReport(null);
    setMessages([]);
    setSelectedAnomaly(null);

    try {
      const data = await fetchCierre(id, per);
      setReport(data);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setLoadError((e as Error).message);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!empresa || !periodo) return;

      // Snapshot pre-existing assistant turns as history (only finished
      // turns — the pending one isn't sent back to the model).
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
          { idempresa: empresa, periodo, message: text, history },
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
                  // 'done' carries the final synthesized text — prefer it
                  // over the streamed buffer (some Ollama runs emit a final
                  // round whose tokens were already streamed; this matches).
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
    [empresa, periodo, messages],
  );

  const onAnomalyPick = useCallback(
    (a: AnomalyRecord) => {
      setSelectedAnomaly(a.idinventariomesdetalle);
      const prompt = `Explícame el hallazgo de "${a.producto_nombre}" en el almacén "${a.almacen_nombre}". ¿Por qué es anómalo, qué impacto tiene y qué debería revisar?`;
      sendMessage(prompt);
    },
    [sendMessage],
  );

  return (
    <div className="relative z-10 flex flex-col h-screen">
      <Header idempresa={empresa} periodo={periodo} status={status} />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(380px,40%)_1fr] min-h-0">
        {/* Left rail */}
        <aside className="border-r hairline flex flex-col min-h-0 overflow-hidden">
          <Selector
            idempresa={empresa}
            periodo={periodo}
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
              <KPICards kpis={report.kpis} totalAnomalies={report.total_anomalies_found} />
              <AnomalyList
                anomalies={report.top_anomalies}
                total={report.total_anomalies_found}
                onPick={onAnomalyPick}
                selectedId={selectedAnomaly}
              />
            </>
          )}
          {status === "idle" && <IdleHint />}
        </aside>

        {/* Right rail — chat */}
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

      <footer className="border-t hairline px-7 py-2.5 flex items-center justify-between font-mono text-[10px] tracking-widish text-ink-500">
        <span>TALOS Copiloto v0.0.1 · prototype</span>
        <span>
          datos read-only · MariaDB <span className="text-ink-400">talos_tecmty</span>
        </span>
      </footer>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-7 py-8 space-y-3 animate-fade-in">
      <p className="label-eyebrow">Generando análisis</p>
      <p className="font-display text-2xl italic text-ink-100 leading-tight">
        Calculando z-scores, ranking impacto financiero, ensamblando reporte…
      </p>
      <div className="space-y-2 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 border hairline bg-ink-800/40 animate-blink"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="font-mono text-[11px] text-ink-400 pt-2">
        Primera carga del periodo: ~5–8s · cache TTL 600s
      </p>
    </div>
  );
}

function IdleHint() {
  return (
    <div className="flex-1 flex items-center justify-center px-7 py-12">
      <div className="text-center max-w-xs space-y-3 animate-fade-in">
        <p className="font-display italic text-xl text-ink-200 leading-tight">
          Cada Cierre cuenta una historia. Ayúdale al auditor a encontrarla.
        </p>
        <p className="font-mono text-[10px] tracking-wide2 uppercase text-ink-500">
          Selecciona arriba para empezar
        </p>
      </div>
    </div>
  );
}
