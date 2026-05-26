import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { fetchAnalyticsDashboard } from "../api/analytics";
import { streamCorporativoChat } from "../api/chat";
import type { ChatHistoryMessage, ChatMessage, CorporativoDashboard } from "../types";
import { CorporativoDashboard as DashboardPanel } from "../components/CorporativoDashboard";
import { ChatPanel } from "../components/ChatPanel";
import { AuditorPage } from "./AuditorPage";

type Tab = "panel" | "auditor";

export function CorporativoPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("panel");
  const [dashboard, setDashboard] = useState<CorporativoDashboard | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatPending, setChatPending] = useState(false);

  useEffect(() => {
    fetchAnalyticsDashboard(30)
      .then(setDashboard)
      .catch((e) => setDashError((e as Error).message));
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const history: ChatHistoryMessage[] = messages
        .filter((m) => !m.pending)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsg: ChatMessage = { role: "user", content: text };
      const pendingAssistant: ChatMessage = {
        role: "assistant",
        content: "",
        pending: true,
      };

      setMessages((prev) => [...prev, userMsg, pendingAssistant]);
      setChatPending(true);

      let buf = "";
      const updateAssistant = (patch: Partial<ChatMessage>) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, ...patch };
          }
          return next;
        });
      };

      try {
        await streamCorporativoChat(
          { message: text, history, days: 30 },
          {
            onEvent: (evt) => {
              switch (evt.type) {
                case "token":
                  buf += evt.content;
                  updateAssistant({ content: buf });
                  break;
                case "done":
                  if (evt.content) buf = evt.content;
                  updateAssistant({ content: buf, pending: false });
                  break;
                case "error":
                  updateAssistant({ content: `⚠ ${evt.message}`, pending: false });
                  break;
              }
            },
            onError: (err) => {
              updateAssistant({ content: `⚠ ${err.message}`, pending: false });
            },
          },
        );
      } finally {
        setChatPending(false);
      }
    },
    [messages],
  );

  return (
    <div className="relative z-10 flex flex-col h-screen">
      <CorporativoHeader
        username={user?.username}
        tab={tab}
        onTab={setTab}
        onLogout={logout}
      />

      <div
        className={`flex-1 min-h-0 flex flex-col ${tab === "panel" ? "" : "hidden"}`}
        aria-hidden={tab !== "panel"}
      >
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(380px,42%)_1fr] min-h-0">
        <aside className="border-r hairline flex flex-col min-h-0">
          {dashError && (
            <p className="px-7 py-4 font-mono text-[12px] text-crit border-b hairline">
              {dashError}
            </p>
          )}
          {dashboard && <DashboardPanel data={dashboard} onAsk={sendMessage} />}
          {!dashboard && !dashError && (
            <div className="px-7 py-8 label-eyebrow animate-blink">Cargando métricas…</div>
          )}
        </aside>

        <div className="min-h-0">
          <ChatPanel
            messages={messages}
            pending={chatPending}
            ready={dashboard != null}
            empresa={null}
            periodo={null}
            mode="corporativo"
            onSend={sendMessage}
          />
        </div>
      </main>

      <footer className="border-t hairline px-7 py-2.5 font-mono text-[10px] tracking-widish text-ink-4">
        Panel corporativo · analytics.db · últimos 30 días
      </footer>
      </div>

      <div
        className={`flex-1 min-h-0 ${tab === "auditor" ? "" : "hidden"}`}
        aria-hidden={tab !== "auditor"}
      >
        <AuditorPage embedded />
      </div>
    </div>
  );
}

function CorporativoHeader({
  username,
  tab,
  onTab,
  onLogout,
}: {
  username?: string;
  tab: Tab;
  onTab: (t: Tab) => void;
  onLogout: () => void;
}) {
  return (
    <header className="border-b hairline px-8 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="label-eyebrow">Corporativo</p>
        <h1 className="font-sans font-semibold text-xl text-ink">Panel de adopción</h1>
        <p className="font-mono text-[10px] text-ink-4 mt-1">
          KPIs de uso del copiloto · clic en tarjeta para preguntar
        </p>
      </div>

      <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-wide2">
        {username && <span className="text-ink-3 hidden sm:inline">{username}</span>}
        <nav className="flex border hairline">
          <TabBtn active={tab === "panel"} onClick={() => onTab("panel")}>
            Panel
          </TabBtn>
          <TabBtn active={tab === "auditor"} onClick={() => onTab("auditor")}>
            Vista auditor
          </TabBtn>
        </nav>
        <button type="button" onClick={onLogout} className="text-ink-4 hover:text-ink">
          Salir
        </button>
      </div>
    </header>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 transition-colors ${
        active ? "bg-accent text-cream" : "bg-cream-2 text-ink-3 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
