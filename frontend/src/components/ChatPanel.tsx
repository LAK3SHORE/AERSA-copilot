import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

interface Props {
  messages: ChatMessage[];
  pending: boolean;
  ready: boolean;
  onSend: (text: string) => void;
  empresa: number | null;
  periodo: string | null;
}

export function ChatPanel({ messages, pending, ready, onSend, empresa, periodo }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // auto-scroll to bottom on new content / streaming tokens
    el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  return (
    <section className="flex flex-col h-full min-h-0">
      <div className="px-7 py-5 border-b hairline flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl italic">Conversación</span>
          <span className="font-mono text-[10px] tracking-wide2 text-ink-400">
            COPILOTO · gemma4:e4b · local
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-widish text-ink-500">§ 04</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
        {messages.length === 0 && (
          <EmptyState empresa={empresa} periodo={periodo} ready={ready} />
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
      </div>

      <ChatInput disabled={!ready || pending} onSubmit={onSend} />
    </section>
  );
}

function EmptyState({
  empresa,
  periodo,
  ready,
}: {
  empresa: number | null;
  periodo: string | null;
  ready: boolean;
}) {
  return (
    <div className="max-w-2xl space-y-4 py-6 animate-fade-in">
      <p className="label-eyebrow">Bienvenida</p>
      <p className="font-display text-3xl italic leading-tight text-ink-50">
        {ready ? (
          <>
            Cierre cargado para <span className="not-italic font-mono text-amber-400 text-2xl">{empresa}</span>{" "}
            <span className="text-ink-300">·</span>{" "}
            <span className="not-italic font-mono text-amber-400 text-2xl">{periodo}</span>.
          </>
        ) : (
          <>Selecciona una empresa y un periodo para comenzar.</>
        )}
      </p>
      {ready && (
        <div className="space-y-2 pt-4">
          <p className="label-eyebrow">Sugerencias</p>
          <ul className="space-y-1.5 font-mono text-[12px] text-ink-300">
            <li>· ¿Qué debo revisar primero en este Cierre?</li>
            <li>· ¿Cómo viene Bebidas comparado con meses anteriores?</li>
            <li>· Explícame el hallazgo más crítico.</li>
            <li>· ¿Hay algún problema recurrente que escalar?</li>
          </ul>
        </div>
      )}
    </div>
  );
}
