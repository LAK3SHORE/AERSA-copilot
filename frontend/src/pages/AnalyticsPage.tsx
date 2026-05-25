import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fetchAnalyticsOverview, fetchSessions, fetchUsageSummary } from "../api/analytics";
import type { AnalyticsOverview } from "../types";

export function AnalyticsPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof fetchUsageSummary>> | null>(null);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof fetchSessions>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAnalyticsOverview(30), fetchUsageSummary(30), fetchSessions(30)])
      .then(([o, u, s]) => {
        setOverview(o);
        setUsage(u);
        setSessions(s);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const maxToolCalls = Math.max(
    1,
    ...(usage?.by_tool.map((t) => t.total_calls) ?? [1]),
  );

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header className="border-b hairline px-8 py-5 flex items-center justify-between">
        <div>
          <p className="label-eyebrow">Corporativo</p>
          <h1 className="font-sans font-semibold text-xl text-ink">Analytics</h1>
          <p className="font-mono text-[10px] text-ink-4 mt-1">
            ¿Cómo está ayudando el copiloto a nuestros auditores?
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[11px] uppercase tracking-wide2 text-accent hover:underline"
        >
          ← Volver al copiloto
        </button>
      </header>

      <main className="flex-1 px-8 py-8 max-w-5xl space-y-8">
        {error && (
          <p className="font-mono text-[12px] text-crit border hairline px-4 py-3">{error}</p>
        )}

        {overview && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Sesiones (30d)" value={String(overview.total_sessions)} />
            <StatCard label="Auditores activos" value={String(overview.active_auditors)} />
            <StatCard
              label="Preguntas / sesión"
              value={overview.avg_questions_per_session.toFixed(1)}
            />
            <StatCard
              label="Herramientas distintas"
              value={String(overview.tool_distribution.length)}
            />
          </section>
        )}

        {usage && usage.by_tool.length > 0 && (
          <section className="border hairline p-5 bg-cream-2 space-y-4">
            <h2 className="label-eyebrow">Uso por herramienta MCP</h2>
            <ul className="space-y-2">
              {usage.by_tool.map((t) => (
                <li key={t.tool_name} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-ink-3 w-44 shrink-0 truncate">
                    {t.tool_name}
                  </span>
                  <div className="flex-1 h-3 bg-cream border hairline relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-accent"
                      style={{ width: `${(t.total_calls / maxToolCalls) * 100}%` }}
                    />
                  </div>
                  <span className="num text-[11px] text-ink tabular-nums w-12 text-right">
                    {t.total_calls}
                  </span>
                  <span className="font-mono text-[9px] text-ink-4 w-14 text-right">
                    {t.avg_duration_ms}ms
                  </span>
                  {t.errors > 0 && (
                    <span className="font-mono text-[9px] text-crit">{t.errors} err</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {usage && usage.by_user.length > 0 && (
          <section className="border hairline overflow-hidden">
            <h2 className="label-eyebrow px-5 py-3 border-b hairline bg-cream-2">
              Actividad por usuario
            </h2>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-ink-4 border-b hairline">
                  <th className="text-left px-5 py-2">Usuario</th>
                  <th className="text-left px-3 py-2">Rol</th>
                  <th className="text-right px-3 py-2">Llamadas</th>
                  <th className="text-right px-5 py-2">Sesiones</th>
                </tr>
              </thead>
              <tbody>
                {usage.by_user.map((u) => (
                  <tr key={u.user_id} className="border-b hairline hover:bg-cream-2">
                    <td className="px-5 py-2 text-ink">{u.username}</td>
                    <td className="px-3 py-2 text-ink-3">{u.role}</td>
                    <td className="px-3 py-2 text-right num">{u.total_calls}</td>
                    <td className="px-5 py-2 text-right num">{u.total_sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {sessions && sessions.sessions.length > 0 && (
          <section className="border hairline overflow-hidden">
            <h2 className="label-eyebrow px-5 py-3 border-b hairline bg-cream-2">
              Sesiones recientes
            </h2>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-ink-4 border-b hairline">
                  <th className="text-left px-5 py-2">Auditor</th>
                  <th className="text-left px-3 py-2">Empresa</th>
                  <th className="text-left px-3 py-2">Periodo</th>
                  <th className="text-right px-3 py-2">Eventos</th>
                  <th className="text-right px-5 py-2">Chat</th>
                </tr>
              </thead>
              <tbody>
                {sessions.sessions.map((s) => (
                  <tr key={s.id} className="border-b hairline hover:bg-cream-2">
                    <td className="px-5 py-2 text-ink">{s.username}</td>
                    <td className="px-3 py-2 num">{s.idempresa}</td>
                    <td className="px-3 py-2">{s.periodo}</td>
                    <td className="px-3 py-2 text-right num">{s.event_count}</td>
                    <td className="px-5 py-2 text-right num">{s.chat_messages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <p className="font-mono text-[10px] text-ink-4">
          Sesión: {user?.username} · rol {user?.role}
        </p>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border hairline px-4 py-3 bg-cream-2">
      <p className="label-eyebrow truncate">{label}</p>
      <p className="mt-1 num text-2xl text-ink tabular-nums">{value}</p>
    </div>
  );
}
