import type { ChatMessage } from "../types";
import { ToolCallTrace } from "./ToolCallTrace";

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`group flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      <span className="font-mono text-[9px] uppercase tracking-wide2 text-ink-500">
        {isUser ? "AUDITOR" : "TALOS · COPILOTO"}
      </span>

      {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
        <div className="w-full max-w-3xl space-y-1">
          {msg.toolCalls.map((tc, i) => (
            <ToolCallTrace key={i} call={tc} />
          ))}
        </div>
      )}

      <div
        className={`max-w-3xl ${
          isUser
            ? "border hairline-strong bg-ink-800/60 px-4 py-3"
            : "px-1 py-1"
        }`}
      >
        <p
          className={`whitespace-pre-wrap leading-relaxed ${
            isUser
              ? "font-mono text-[13px] text-ink-100"
              : "font-sans text-[15px] text-ink-50"
          }`}
        >
          {msg.content || (msg.pending && !isUser ? "" : "")}
          {msg.pending && !isUser && (
            <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-amber-400 animate-blink" />
          )}
        </p>
      </div>
    </div>
  );
}
