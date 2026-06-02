import type { CorporativoDashboard } from "../types";
import {
  promptAuditor,
  promptEmpresa,
  promptLeastUsed,
  promptMostUsed,
  promptSessions,
  promptToolCalls,
  promptToolRanking,
} from "../lib/corporativoPrompts";

interface Props {
  data: CorporativoDashboard;
  onAsk: (prompt: string) => void;
}

export function CorporativoDashboard({ data, onAsk }: Props) {
  const o = data.overview;
  const most = data.tools.most_used;
  const least = data.tools.least_used;
  const maxCalls = Math.max(1, ...data.tools.ranking.map((t) => t.total_calls));

  return (
    <div className="flex flex-col min-h-0 overflow-y-auto">
      <section className="px-7 py-4 border-b hairline space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="label-eyebrow">Uso del copiloto · {data.period_days}d</span>
        </div>

        <button
          type="button"
          onClick={() => onAsk(promptSessions(data))}
          className="group block w-full text-left border hairline-strong p-3.5 bg-cream-2 hover:bg-cream-3 hover:border-accent transition-colors relative cursor-pointer"
        >
          <span className="absolute top-0 right-0 px-2 py-1 font-mono text-[9px] tracking-wide2 text-accent border-l border-b hairline-strong">
            SESIONES
          </span>
          <div className="num text-2xl md:text-[26px] font-medium tabular-nums text-ink leading-tight">
            {o.total_sessions}
          </div>
          <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widish text-ink-3 flex-wrap">
            <span>{o.active_auditors} auditores</span>
            <span className="text-ink-5">·</span>
            <span>{o.total_chat_messages ?? 0} mensajes chat</span>
            <span className="text-ink-5">·</span>
            <span>
              {(o.avg_mcp_calls_per_active_session ?? 0).toFixed(1)} MCP/sesión activa
            </span>
          </div>
          <span className="absolute bottom-1.5 right-2.5 font-mono text-[10px] text-ink-4 opacity-0 group-hover:opacity-100 transition-opacity">
            preguntar →
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <Tile
            label="Llamadas MCP"
            value={String(o.total_tool_calls)}
            onAsk={() => onAsk(promptToolCalls(data))}
          />
          <Tile
            label="Herramientas"
            value={String(o.distinct_tools)}
            onAsk={() => onAsk(promptToolRanking(data))}
          />
        </div>
      </section>

      <section className="px-7 py-4 border-b hairline space-y-3">
        <span className="label-eyebrow">Herramientas MCP</span>
        <div className="grid grid-cols-2 gap-2">
          <Tile
            label="Más usada"
            value={most?.tool_name ?? "—"}
            sub={most ? `${most.total_calls} llamadas` : undefined}
            onAsk={() => onAsk(promptMostUsed(data))}
          />
          <Tile
            label="Menos usada"
            value={least?.tool_name ?? "—"}
            sub={least ? `${least.total_calls} llamadas` : undefined}
            onAsk={() => onAsk(promptLeastUsed(data))}
          />
        </div>

        {data.tools.ranking.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {data.tools.ranking.map((t) => (
              <li key={t.tool_name}>
                <button
                  type="button"
                  onClick={() =>
                    onAsk(
                      `La herramienta "${t.tool_name}" tuvo ${t.total_calls} llamadas MCP ` +
                        `(${t.unique_users} usuarios, ${t.errors} errores). ` +
                        `¿Cómo encaja en el flujo de auditoría y deberíamos impulsar o limitar su uso?`,
                    )
                  }
                  className="group w-full text-left flex items-center gap-2 py-1 hover:text-accent"
                >
                  <span className="font-mono text-[10px] text-ink-3 w-40 shrink-0 truncate">
                    {t.tool_name}
                  </span>
                  <div className="flex-1 h-2 bg-cream border hairline relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-accent"
                      style={{ width: `${(t.total_calls / maxCalls) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-ink-2 w-8 text-right">
                    {t.total_calls}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.by_empresa.length > 0 && (
        <section className="px-7 py-4 border-b hairline space-y-2">
          <span className="label-eyebrow">Por empresa</span>
          <ul className="space-y-1">
            {data.by_empresa.map((row) => (
              <li key={row.idempresa}>
                <button
                  type="button"
                  onClick={() => onAsk(promptEmpresa(row, data.period_days))}
                  className="group w-full text-left border hairline px-3 py-2 bg-cream hover:bg-cream-3 hover:border-accent transition-colors"
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-mono text-[11px] text-ink">
                      Empresa {row.idempresa}
                    </span>
                    <span className="font-mono text-[10px] text-accent opacity-0 group-hover:opacity-100">
                      analizar →
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-ink-3 mt-0.5">
                    {row.audit_sessions} sesiones · {row.tool_calls} MCP · {row.chat_messages}{" "}
                    chat
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.by_auditor.length > 0 && (
        <section className="px-7 py-4 border-b hairline space-y-2">
          <span className="label-eyebrow">Auditores</span>
          <ul className="space-y-1">
            {data.by_auditor.map((row) => (
              <li key={row.user_id}>
                <button
                  type="button"
                  onClick={() => onAsk(promptAuditor(row, data.period_days))}
                  className="group w-full text-left border hairline px-3 py-2 bg-cream hover:bg-cream-3 hover:border-accent transition-colors"
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-mono text-[11px] text-ink">{row.username}</span>
                    <span className="font-mono text-[10px] text-ink-3">
                      {row.total_calls} MCP · {row.total_sessions} ses.
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  onAsk,
}: {
  label: string;
  value: string;
  sub?: string;
  onAsk: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAsk}
      className="group text-left border hairline px-2.5 py-2 bg-cream hover:bg-cream-3 hover:border-accent transition-colors cursor-pointer"
    >
      <div className="label-eyebrow truncate group-hover:text-accent transition-colors">
        {label}
      </div>
      <div className="mt-0.5 num text-[14px] tabular-nums text-ink truncate">{value}</div>
      {sub && (
        <div className="font-mono text-[9px] text-ink-4 mt-0.5 truncate">{sub}</div>
      )}
    </button>
  );
}
