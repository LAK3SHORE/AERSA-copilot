import type { Herramienta } from "../../types/cierre";
import type { OpenChatFn } from "../../lib/chatTypes";
import { Section } from "../shared/Section";

export function ToolsSection({
  tools,
  openChat,
}: {
  tools: Herramienta[];
  openChat: OpenChatFn;
}) {
  return (
    <Section num={3} label="Herramientas del Copiloto">
      <div className="bg-white border border-accent-2/30 p-3 mb-2.5 flex gap-3 items-start">
        <span className="font-mono text-base text-accent-2 shrink-0">⊙</span>
        <div>
          <div className="font-sans text-[13px] font-medium text-ink mb-1">
            El Copiloto responde la mayoría de las preguntas que surgen de estos datos
          </div>
          <div className="font-sans text-xs text-ink-2 leading-relaxed">
            Haz clic en una tarjeta para abrir el chat con un prompt sugerido.
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {tools.map((tool) => (
          <button
            key={tool.nombre}
            type="button"
            onClick={() => openChat(tool.prompt)}
            className="text-left border border-accent-2/25 border-l-[3px] border-l-accent-2 p-3 bg-white hover:bg-accent-2/10 cursor-pointer transition-colors"
          >
            <div className="font-mono text-[11px] font-medium text-accent mb-0.5 tracking-wide">
              {tool.nombre}
            </div>
            <div className="font-sans text-[11.5px] text-ink-2 mb-1.5 leading-snug">{tool.desc}</div>
            <div className="font-mono text-[9.5px] text-ink-3 border-t border-ink/10 pt-1.5">
              <span className="text-ink-4">ej: </span>
              {tool.ejemplo}
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}
