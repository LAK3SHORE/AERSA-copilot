import { useEffect, useState } from "react";
import type { UserRole } from "../types/auth";

export function Header({
  idempresa,
  periodo,
  status,
  username,
  role,
  onOpenAnalytics,
  onLogout,
}: {
  idempresa: number | null;
  periodo: string | null;
  status: "idle" | "loading" | "ready" | "error";
  username?: string;
  role?: UserRole;
  onOpenAnalytics?: () => void;
  onLogout?: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("es-MX", { hour12: false });
  const statusColor =
    status === "ready"
      ? "bg-accent"
      : status === "error"
        ? "bg-crit"
        : status === "loading"
          ? "bg-accent-2 animate-blink"
          : "bg-ink-5";
  const statusText =
    status === "ready"
      ? "EN LÍNEA"
      : status === "error"
        ? "ERROR"
        : status === "loading"
          ? "CARGANDO"
          : "INACTIVO";

  const roleLabel =
    role === "corporativo" ? "CORP" : role === "auditor" ? "AUD" : null;

  return (
    <header className="relative z-10 border-b hairline">
      <div className="flex items-stretch justify-between px-8 py-5">
        <div className="flex items-baseline gap-5">
          <div className="flex items-baseline gap-3">
            <span className="font-sans font-semibold text-2xl leading-none tracking-tight text-ink">
              TALOS
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wide2 text-ink-3">
              Copiloto Analítico de Auditoría
            </span>
          </div>
          <span className="hidden md:inline-block h-4 w-px bg-ink-5" />
          <span className="hidden md:inline-block font-mono text-[10px] uppercase tracking-wide2 text-ink-4">
            AERSA · Tec de Monterrey
          </span>
        </div>

        <div className="flex items-center gap-5 font-mono text-[11px] tracking-widish text-ink-2">
          {username && (
            <span className="hidden sm:inline text-ink-3">
              {username}
              {roleLabel && (
                <span className="ml-1.5 text-accent">{roleLabel}</span>
              )}
            </span>
          )}
          {onOpenAnalytics && (
            <button
              type="button"
              onClick={onOpenAnalytics}
              className="text-accent hover:underline uppercase tracking-wide2"
            >
              Analytics
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="text-ink-4 hover:text-ink uppercase tracking-wide2"
            >
              Salir
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-ink-4">EMP</span>
            <span className="num text-ink">{idempresa ?? "—"}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-ink-4">PER</span>
            <span className="num text-ink">{periodo ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />
            <span className="text-ink-2">{statusText}</span>
          </div>
          <span className="num text-ink-3">{time}</span>
        </div>
      </div>
    </header>
  );
}
