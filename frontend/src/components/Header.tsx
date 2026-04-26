import { useEffect, useState } from "react";

export function Header({
  idempresa,
  periodo,
  status,
}: {
  idempresa: number | null;
  periodo: string | null;
  status: "idle" | "loading" | "ready" | "error";
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("es-MX", { hour12: false });
  const statusColor =
    status === "ready" ? "bg-amber-400" : status === "error" ? "bg-crit" : status === "loading" ? "bg-amber-500 animate-blink" : "bg-ink-400";
  const statusText =
    status === "ready" ? "EN LÍNEA" : status === "error" ? "ERROR" : status === "loading" ? "CARGANDO" : "INACTIVO";

  return (
    <header className="relative z-10 border-b hairline">
      <div className="flex items-stretch justify-between px-8 py-5">
        <div className="flex items-baseline gap-5">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl leading-none italic tracking-tight">TALOS</span>
            <span className="font-mono text-[10px] uppercase tracking-wide2 text-ink-300">
              Copiloto Analítico de Auditoría
            </span>
          </div>
          <span className="hidden md:inline-block h-4 w-px bg-ink-600" />
          <span className="hidden md:inline-block font-mono text-[10px] uppercase tracking-wide2 text-ink-400">
            AERSA × Tec de Monterrey · MA3001B
          </span>
        </div>

        <div className="flex items-center gap-6 font-mono text-[11px] tracking-widish text-ink-200">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-ink-400">EMP</span>
            <span className="num text-ink-100">{idempresa ?? "—"}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-ink-400">PER</span>
            <span className="num text-ink-100">{periodo ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />
            <span className="text-ink-200">{statusText}</span>
          </div>
          <span className="num text-ink-300">{time}</span>
        </div>
      </div>
    </header>
  );
}
