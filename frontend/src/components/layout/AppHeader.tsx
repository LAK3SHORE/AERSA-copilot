import { useEffect, useState } from "react";
import type { ChatMode } from "../../lib/chatTypes";
import { fmtPeriodo } from "../../lib/fmt";

interface Props {
  isAdmin: boolean;
  username?: string;
  idempresa?: number | null;
  periodo?: string | null;
  chatOpen: boolean;
  chatMode: ChatMode;
  onToggleChat: () => void;
  onLogout: () => void;
}

export function AppHeader({
  isAdmin,
  username,
  idempresa,
  periodo,
  chatOpen,
  chatMode,
  onToggleChat,
  onLogout,
}: Props) {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );

  useEffect(() => {
    const id = setInterval(
      () =>
        setTime(
          new Date().toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        ),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const chatLabel = chatMode === "sql" ? "CONSULTA SQL" : "COPILOTO";

  return (
    <header
      className="h-[38px] shrink-0 border-b-2 border-accent-2 flex items-center px-4 gap-0"
      style={{ background: "rgb(134, 156, 78)" }}
    >
      <span className="font-mono text-[13px] font-semibold tracking-wide text-cream mr-3">
        TALOS
      </span>
      <span className="font-mono text-[9.5px] tracking-wide2 text-cream/65 mr-3 hidden sm:inline">
        COPILOTO ANALÍTICO DE AUDITORÍA
      </span>
      <span className="w-px h-3.5 bg-cream/25 mr-3 hidden md:block" />
      <span className="font-mono text-[9.5px] text-cream tracking-widish hidden lg:inline">
        AERSA · TEC DE MONTERREY
      </span>
      <span className="w-px h-3.5 bg-cream/25 mx-3 hidden lg:block" />
      <button
        type="button"
        onClick={onLogout}
        className="font-mono text-[9.5px] tracking-wide2 text-cream/70 hover:text-cream hover:bg-cream/15 border-0 bg-transparent cursor-pointer px-1.5 py-1"
      >
        SALIR
      </button>

      <div className="flex-1" />

      {!isAdmin && (
        <>
          {username && (
            <span className="font-mono text-[10px] text-cream mr-3 hidden sm:inline">
              {username} <span className="text-cream/55 font-bold">AUD</span>
            </span>
          )}
          {idempresa != null && (
            <span className="font-mono text-[10px] text-cream mr-3">
              EMP <strong>{idempresa}</strong>
            </span>
          )}
          {periodo && (
            <span className="font-mono text-[10px] text-cream mr-3">
              PER <strong>{fmtPeriodo(periodo)}</strong>
            </span>
          )}
          <span className="font-mono text-[10px] text-cream mr-3 hidden sm:flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 inline-block" />
            EN LÍNEA
          </span>
          <span className="font-mono text-[10px] text-cream mr-3 hidden md:inline">{time}</span>
        </>
      )}
      {isAdmin && (
        <span className="font-mono text-[10px] text-cream mr-3">
          CORPORATIVO · <strong>{username ?? "admin"}</strong>
        </span>
      )}

      <button
        type="button"
        onClick={onToggleChat}
        className="font-mono text-[9.5px] tracking-wide2 px-2.5 py-1 border flex items-center gap-1 cursor-pointer transition-all"
        style={{
          borderColor: chatOpen ? "#FFF8E3" : "rgba(255,248,227,0.35)",
          background: chatOpen ? "#FFF8E3" : "transparent",
          color: chatOpen ? "#333333" : "rgba(255,248,227,0.85)",
        }}
      >
        <span>{chatOpen ? "✕" : "≡"}</span>
        <span>{chatLabel}</span>
      </button>
    </header>
  );
}
