import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ChatMode } from "../../lib/chatTypes";
import { SqlResultTable } from "./SqlResultTable";

export function ChatMsg({ msg, mode }: { msg: ChatMessage; mode: ChatMode }) {
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

  return (
    <div className="mb-5">
      <div className="font-mono text-[9px] tracking-wide2 text-ink-4 mb-1.5">{label}</div>
      {msg.toolCalls?.map((tc, i) => (
        <div key={i} className="font-mono text-[10px] text-ink-3 mb-1">
          <span className="text-accent">✓</span> tool{" "}
          <span className="text-ink-2">{tc.name}</span>
        </div>
      ))}
      <div className="md-content text-[12.5px] leading-relaxed">
        {msg.content && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        )}
        {msg.pending && (
          <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-accent animate-blink" />
        )}
      </div>
      {msg.sqlResult && (
        <>
          <pre className="bg-accent/5 p-2.5 text-[10px] overflow-x-auto my-2 font-mono">
            <code>{msg.sqlResult.sql}</code>
          </pre>
          <SqlResultTable
            columns={msg.sqlResult.columns}
            rows={msg.sqlResult.rows}
          />
        </>
      )}
    </div>
  );
}
