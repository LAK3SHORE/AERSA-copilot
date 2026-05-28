import { useEffect, useState } from "react";
import { fetchAnalyticsDashboard } from "../../api/analytics";
import type { CorporativoDashboard } from "../../types";
import type { OpenChatFn } from "../../lib/chatTypes";
import { Eyebrow } from "../shared/Eyebrow";
import { McpBarsChart } from "./McpBarsChart";
import { SessionLineChart } from "./SessionLineChart";

export function PanelAdopcion({ openChat }: { openChat: OpenChatFn }) {
  const [dash, setDash] = useState<CorporativoDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsDashboard(30)
      .then(setDash)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) {
    return <p className="px-7 py-4 font-mono text-xs text-crit">{err}</p>;
  }
  if (!dash) {
    return <p className="px-7 py-8 font-mono text-[10px] text-ink-4 animate-blink">Cargando…</p>;
  }

  const d = dash;
  const o = d.overview;
  const analyticsPrompt = `En los últimos ${d.period_days} días hubo ${o.total_sessions} sesiones con ${o.active_auditors} auditores activos y ${o.total_tool_calls} llamadas MCP. ¿Qué empresas o auditores están rezagados?`;

  const dailySessions = d.daily_trend.map((x) => x.calls);
  const toolBars = d.tools.ranking.map((t) => ({
    nombre: t.tool_name,
    llamadas: t.total_calls,
  }));

  const kpis = [
    { label: "SESIONES", val: String(o.total_sessions), sub: "últimos 30 días" },
    { label: "AUDITORES ACTIVOS", val: String(o.active_auditors), sub: "en el período" },
    {
      label: "PREGUNTAS / SESIÓN",
      val: o.avg_questions_per_session.toFixed(1),
      sub: "promedio",
    },
    { label: "LLAMADAS MCP", val: String(o.total_tool_calls), sub: "total herramientas" },
    {
      label: "HERRAMIENTAS USADAS",
      val: String(o.distinct_tools),
      sub: `de ${d.tools.ranking.length} disponibles`,
    },
  ];

  return (
    <div className="px-7 py-6 overflow-y-auto h-full">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b-2 border-accent-2">
          <Eyebrow>Uso del Copiloto</Eyebrow>
          <span className="font-mono text-[9.5px] text-ink-3">{o.total_tool_calls} total</span>
        </div>
        <div className="grid grid-cols-5">
          {kpis.map((k, i) => (
            <button
              key={k.label}
              type="button"
              onClick={() => openChat(analyticsPrompt, "analytics")}
              className={`p-3 border border-accent-3 text-left hover:bg-accent/5 cursor-pointer bg-cream-2 ${
                i > 0 ? "border-l-0" : ""
              }`}
            >
              <div className="font-mono text-[9px] tracking-widish text-ink-3 mb-1">{k.label}</div>
              <div className="font-mono text-[22px] font-semibold tracking-tight text-ink mb-0.5">
                {k.val}
              </div>
              <div className="font-mono text-[9px] text-ink-4">{k.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="border border-accent-3 p-3.5 bg-cream-2">
          <div className="flex justify-between items-baseline mb-3">
            <Eyebrow>Sesiones Diarias</Eyebrow>
            <span className="font-mono text-[9px] text-ink-5">últimos 30 días</span>
          </div>
          <SessionLineChart data={dailySessions.length ? dailySessions : [0]} />
        </div>
        <div className="border border-accent-3 p-3.5 bg-cream-2">
          <div className="flex justify-between items-baseline mb-3">
            <Eyebrow>Herramientas MCP</Eyebrow>
            <div className="flex gap-4 text-center">
              <div>
                <div className="font-mono text-[8px] text-ink-4 mb-0.5">MÁS USADA</div>
                <div className="font-mono text-[10px] text-accent">
                  {d.tools.most_used?.tool_name ?? "—"}
                </div>
              </div>
              <div>
                <div className="font-mono text-[8px] text-ink-4 mb-0.5">MENOS USADA</div>
                <div className="font-mono text-[10px] text-ink-3">
                  {d.tools.least_used?.tool_name ?? "—"}
                </div>
              </div>
            </div>
          </div>
          <McpBarsChart data={toolBars} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-accent-3 p-3.5 bg-cream-2">
          <div className="mb-2.5 pb-1.5 border-b border-accent-3">
            <Eyebrow>Por Empresa</Eyebrow>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["EMPRESA", "SES", "MCP", "CHAT"].map((h) => (
                  <th
                    key={h}
                    className={`font-mono text-[8.5px] tracking-widish text-ink-4 font-normal py-0.5 ${
                      h === "EMPRESA" ? "text-left" : "text-right"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.by_empresa.map((row, i) => (
                <tr
                  key={row.idempresa}
                  className={`border-t border-accent-3 cursor-pointer hover:bg-accent/5 ${
                    i % 2 === 1 ? "bg-accent/7" : ""
                  }`}
                  onClick={() => openChat(analyticsPrompt, "analytics")}
                >
                  <td className="font-sans text-[11.5px] py-1.5">Empresa {row.idempresa}</td>
                  {[row.audit_sessions, row.tool_calls, row.chat_messages].map((v, j) => (
                    <td
                      key={j}
                      className="font-mono text-[11px] text-right text-ink-2 py-1.5"
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border border-accent-3 p-3.5 bg-cream-2">
          <div className="mb-2.5 pb-1.5 border-b border-accent-3">
            <Eyebrow>Por Auditor</Eyebrow>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["AUDITOR", "MCP", "SES"].map((h) => (
                  <th
                    key={h}
                    className={`font-mono text-[8.5px] tracking-widish text-ink-4 font-normal py-0.5 ${
                      h === "AUDITOR" ? "text-left" : "text-right"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.by_auditor.map((row, i) => (
                <tr
                  key={row.user_id}
                  className={`border-t border-accent-3 hover:bg-accent/5 ${
                    i % 2 === 1 ? "bg-accent/7" : ""
                  }`}
                >
                  <td className="font-mono text-[11px] py-1.5">{row.username}</td>
                  <td className="font-mono text-[11px] text-right text-ink-2 py-1.5">
                    {row.total_calls}
                  </td>
                  <td className="font-mono text-[11px] text-right text-ink-2 py-1.5">
                    {row.total_sessions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
