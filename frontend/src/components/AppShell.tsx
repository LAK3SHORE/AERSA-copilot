import { useCallback, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { ChatDrawer } from "./chat/ChatDrawer";
import { AppHeader } from "./layout/AppHeader";
import { useAppChat } from "../hooks/useAppChat";
import type { ChatMode, OpenChatFn, SqlDatosRawPayload, SqlResultPayload } from "../lib/chatTypes";
import { buildSqlRawFilter } from "../lib/sqlToRawFilter";
import type { FindingContextPayload } from "../lib/findingPrompt";

const CHAT_WIDTH = 450;

export interface AppShellContext {
  idempresa: number | null;
  periodo: string | null;
  sessionId: number | null;
  setCierreContext: (ctx: {
    idempresa: number;
    periodo: string;
    sessionId: number | null;
  }) => void;
  openChat: OpenChatFn;
  setChatMode: (m: ChatMode) => void;
  setSqlContext: (ctx: { idempresa: number; periodo: string; tabla: string }) => void;
  chatReady: boolean;
  showSqlInDatosRaw: (result: SqlResultPayload) => void;
  sqlDatosRawPayload: SqlDatosRawPayload | null;
  clearSqlDatosRaw: () => void;
}

interface Props {
  isAdmin: boolean;
  children: (ctx: AppShellContext) => ReactNode;
  sqlTabla?: string;
}

export function AppShell({ isAdmin, children, sqlTabla = "cierre_detalle" }: Props) {
  const { user, logout } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>(isAdmin ? "analytics" : "audit");
  const [chatSeed, setChatSeed] = useState<string | null>(null);
  const [chatSeedK, setChatSeedK] = useState(0);
  const [idempresa, setIdempresa] = useState<number | null>(
    user?.role === "auditor" ? user.idempresa ?? null : null,
  );
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [tabla, setTabla] = useState(sqlTabla);
  const [sqlDatosRawPayload, setSqlDatosRawPayload] = useState<SqlDatosRawPayload | null>(
    null,
  );

  const pendingFinding = useRef<FindingContextPayload | null>(null);

  const { messages, pending, sendMessage } = useAppChat({
    idempresa,
    periodo,
    sessionId,
    tabla,
  });

  const openChat: OpenChatFn = useCallback(
    (prompt, mode, opts) => {
      const m = mode ?? chatMode;
      setChatMode(m);
      pendingFinding.current = opts?.findingContext ?? null;
      setChatSeed(prompt);
      setChatSeedK((k) => k + 1);
      setChatOpen(true);
    },
    [chatMode],
  );

  const setCierreContext = useCallback(
    (ctx: { idempresa: number; periodo: string; sessionId: number | null }) => {
      setIdempresa(ctx.idempresa);
      setPeriodo(ctx.periodo);
      setSessionId(ctx.sessionId);
    },
    [],
  );

  const handleSend = useCallback(
    (text: string) => {
      const fc = pendingFinding.current;
      pendingFinding.current = null;
      void sendMessage(text, chatMode, fc ? { findingContext: fc } : undefined);
    },
    [sendMessage, chatMode],
  );

  const setSqlContext = useCallback(
    (ctx: { idempresa: number; periodo: string; tabla: string }) => {
      setIdempresa(ctx.idempresa);
      setPeriodo(ctx.periodo);
      setTabla(ctx.tabla);
    },
    [],
  );

  const chatReady =
    chatMode === "analytics" ||
    (chatMode === "sql" ? idempresa != null && periodo != null : idempresa != null && periodo != null);

  const showSqlInDatosRaw = useCallback(
    (result: SqlResultPayload) => {
      if (!isAdmin || idempresa == null || !periodo) return;
      setSqlDatosRawPayload({
        idempresa,
        periodo,
        sql: result.sql,
        explanation: result.explanation,
        sqlRowCount: result.row_count,
        filter: buildSqlRawFilter(result.columns, result.rows),
        requestId: Date.now(),
      });
    },
    [isAdmin, idempresa, periodo],
  );

  return (
    <div className="h-screen flex flex-col bg-cream text-ink overflow-hidden">
      <AppHeader
        isAdmin={isAdmin}
        username={user?.username}
        idempresa={idempresa}
        periodo={periodo}
        chatOpen={chatOpen}
        chatMode={chatMode}
        onToggleChat={() => setChatOpen((o) => !o)}
        onLogout={logout}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {children({
            idempresa,
            periodo,
            sessionId,
            setCierreContext,
            openChat,
            setChatMode,
            setSqlContext,
            chatReady: chatReady ?? false,
            showSqlInDatosRaw,
            sqlDatosRawPayload,
            clearSqlDatosRaw: () => setSqlDatosRawPayload(null),
          })}
        </div>

        <div
          className="shrink-0 overflow-hidden border-l border-accent-3 bg-cream-2 flex flex-col transition-[width,min-width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            width: chatOpen ? CHAT_WIDTH : 0,
            minWidth: chatOpen ? CHAT_WIDTH : 0,
          }}
        >
          <div style={{ width: CHAT_WIDTH, height: "100%" }} className="shrink-0">
            <ChatDrawer
              isOpen={chatOpen}
              mode={chatMode}
              onClose={() => setChatOpen(false)}
              seedPrompt={chatSeed}
              seedKey={chatSeedK}
              messages={messages}
              pending={pending}
              onSend={handleSend}
              ready={chatReady}
              onShowSqlInDatosRaw={isAdmin ? showSqlInDatosRaw : undefined}
              canShowSqlInDatosRaw={isAdmin && idempresa != null && periodo != null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ChatMode };
