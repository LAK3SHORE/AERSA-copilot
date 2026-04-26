import { useState, useRef, useEffect } from "react";

interface Props {
  disabled: boolean;
  onSubmit: (text: string) => void;
}

export function ChatInput({ disabled, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
  }, [value]);

  function send() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div className="border-t hairline-strong bg-ink-900/80 backdrop-blur-sm">
      <div className="flex items-end gap-3 px-6 py-4">
        <span className="font-mono text-[10px] uppercase tracking-wide2 text-ink-500 pb-2 select-none">
          {">"}
        </span>
        <textarea
          ref={ref}
          value={value}
          disabled={disabled}
          rows={1}
          placeholder={
            disabled
              ? "Esperando respuesta…"
              : "Pregunta al copiloto sobre este Cierre…"
          }
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="flex-1 resize-none bg-transparent font-sans text-[14px] text-ink-50 placeholder:text-ink-500 outline-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!value.trim() || disabled}
          className="self-stretch px-4 border hairline-strong font-mono text-[10px] uppercase tracking-wide2 text-ink-200 hover:bg-amber-500 hover:text-ink-900 hover:border-amber-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Enviar ↵
        </button>
      </div>
    </div>
  );
}
