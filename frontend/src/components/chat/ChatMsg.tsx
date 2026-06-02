import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ChatMode, SqlResultPayload } from "../../lib/chatTypes";
import { SqlResultTable } from "./SqlResultTable";

export function ChatMsg({
  msg,
  mode,
  onShowSqlInDatosRaw,
  canShowSqlInDatosRaw,
}: {
  msg: ChatMessage;
  mode: ChatMode;
  onShowSqlInDatosRaw?: (result: SqlResultPayload) => void;
  canShowSqlInDatosRaw?: boolean;
}) {
  if (msg.role === "user") {
    const who = mode === "analytics" ? "OWNER" : mode === "sql" ? "CORP" : "AUDITOR";
    return (
      <div className="mb-5">
        <div className="font-mono text-[9px] tracking-wide2 text-ink-4 mb-1 text-right">
          {who}
        </div>
        <div className="border border-accent-3 px-3 py-2 font-mono text-[11px] text-ink leading-relaxed ml-8">
          {msg.content}
        </div>
      </div>
    );
  }

  const label =
    mode === "sql" ? "TALOS · SQL" : mode === "analytics" ? "TALOS · OWNER" : "TALOS · COPILOTO";

  const isSql = mode === "sql" && msg.sqlResult;
  const showDatosRawBtn =
    isSql &&
    !msg.pending &&
    canShowSqlInDatosRaw &&
    onShowSqlInDatosRaw &&
    msg.sqlResult;

  return (
    <div className="mb-5">
      <div className="font-mono text-[9px] tracking-wide2 text-ink-4 mb-1.5">{label}</div>
      {msg.toolCalls?.map((tc, i) => (
        <div key={i} className="font-mono text-[10px] text-ink-3 mb-1">
          <span className="text-accent">✓</span> tool{" "}
          <span className="text-ink-2">{tc.name}</span>
        </div>
      ))}

      {isSql ? (
        <div className="text-[12.5px] leading-relaxed space-y-2">
          <p className="text-ink">{msg.sqlResult!.explanation}</p>
          <p className="font-mono text-[10px] text-ink-3">
            {msg.sqlResult!.row_count}{" "}
            {msg.sqlResult!.row_count === 1 ? "fila devuelta" : "filas devueltas"}
            {msg.sqlResult!.truncated && (
              <span className="text-[#C26020]"> · resultado truncado al máximo</span>
            )}
          </p>
          <pre className="bg-accent/5 p-2.5 text-[10px] overflow-x-auto font-mono border border-accent-3/40">
            <code>{msg.sqlResult!.sql}</code>
          </pre>
          <SqlResultTable
            columns={msg.sqlResult!.columns}
            rows={msg.sqlResult!.rows}
            rowCount={msg.sqlResult!.row_count}
            maxRows={20}
          />
          {showDatosRawBtn && (
            <button
              type="button"
              onClick={() => onShowSqlInDatosRaw(msg.sqlResult!)}
              className="font-mono text-[10px] tracking-widish px-2.5 py-1.5 bg-accent text-ink border-0 cursor-pointer hover:opacity-90 w-full text-left"
            >
              VER EN DATOS RAW →
            </button>
          )}
        </div>
      ) : (
        <div className="md-content text-[12.5px] leading-relaxed">
          {msg.content && (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          )}
        </div>
      )}

      {msg.pending && (
        <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-accent animate-blink" />
      )}
    </div>
  );
}
