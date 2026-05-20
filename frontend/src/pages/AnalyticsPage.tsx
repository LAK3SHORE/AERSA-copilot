import { useAuth } from "../auth/AuthContext";

export function AnalyticsPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header className="border-b hairline px-8 py-5 flex items-center justify-between">
        <div>
          <p className="label-eyebrow">Corporativo</p>
          <h1 className="font-sans font-semibold text-xl text-ink">Analytics</h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[11px] uppercase tracking-wide2 text-accent hover:underline"
        >
          ← Volver al copiloto
        </button>
      </header>
      <main className="flex-1 px-8 py-12 max-w-lg">
        <p className="font-sans text-lg text-ink-2 leading-snug">
          Panel de métricas MCP y cobertura de auditores — Session 13.
        </p>
        <p className="font-mono text-[11px] text-ink-4 mt-4">
          Sesión: {user?.username} · rol {user?.role}
        </p>
      </main>
    </div>
  );
}
