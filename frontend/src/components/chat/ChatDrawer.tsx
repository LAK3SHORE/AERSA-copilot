import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatMode } from "../../lib/chatTypes";
import { ChatMsg } from "./ChatMsg";
import { ThinkingDots } from "./ThinkingDots";

interface Props {
  isOpen: boolean;
  mode: ChatMode;
  onClose: () => void;
  seedPrompt: string | null;
  seedKey: number;
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  ready: boolean;
}

export function ChatDrawer({
  isOpen,
  mode,
  onClose,
  seedPrompt,
  seedKey,
  messages,
  pending,
  onSend,
  ready,
}: Props) {
  const [input, setInput] = useState("");
  const msgsRef = useRef<HTMLDivElement>(null);
  const prevKey = useRef<number | null>(null);

  useEffect(() => {
    if (seedPrompt && seedKey !== prevKey.current && isOpen) {
      prevKey.current = seedKey;
      onSend(seedPrompt);
    }
  }, [seedPrompt, seedKey, isOpen, onSend]);

  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const doSend = useCallback(() => {
    const t = input.trim();
    if (!t || pending || !ready) return;
    setInput("");
    onSend(t);
  }, [input, pending, ready, onSend]);

  const modeLabel =
    mode === "sql"
      ? "CONSULTA · SQL"
      : mode === "analytics"
        ? "OWNER · analytics"
        : "COPILOTO · gemma4:e4b · local";

  const placeholder =
    mode === "sql"
      ? "Pregunta en lenguaje natural..."
      : "Pregunta al copiloto sobre este Cierre...";

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream-2">
      <div className="px-4 py-2.5 border-b border-accent-3 flex items-center justify-between shrink-0 bg-cream-2">
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[13px] font-medium">Conversación</span>
          <span className="font-mono text-[9.5px] text-ink-4 tracking-widish">{modeLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-ink-5">{mode === "sql" ? "01" : "04"}</span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] text-ink-4 hover:text-ink bg-transparent border-0 cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      </div>

      <div ref={msgsRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-ink-5 font-mono text-[10px] tracking-widish text-center leading-loose">
            {mode === "sql"
              ? "Consulta la base de datos\nen lenguaje natural"
              : "Haz clic en cualquier hallazgo,\nacción o herramienta para comenzar"}
          </div>
        )}
        {messages.map((m, i) => (
          <ChatMsg key={i} msg={m} mode={mode} />
        ))}
        {pending && <ThinkingDots />}
      </div>

      <div className="border-t border-accent-3 px-3 py-2 flex items-center gap-2 shrink-0 bg-cream-2">
        <span className="font-mono text-[11px] text-ink-5">›</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              doSend();
            }
          }}
          placeholder={placeholder}
          disabled={!ready || pending}
          className="flex-1 bg-transparent border-0 outline-none font-mono text-[11px] text-ink disabled:opacity-50"
        />
        <button
          type="button"
          onClick={doSend}
          disabled={pending || !input.trim() || !ready}
          className="font-mono text-[10px] tracking-widish px-2 py-1 border-0 bg-transparent cursor-pointer disabled:text-accent/25 text-accent"
        >
          ENVIAR
        </button>
      </div>
    </div>
  );
}
