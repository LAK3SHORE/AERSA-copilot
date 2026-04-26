import type { ToolCallIndicator } from "../types";

const STATUS_COLOR = {
  running: "text-amber-400 animate-blink",
  done: "text-amber-400",
  error: "text-crit",
} as const;

const STATUS_GLYPH = {
  running: "···",
  done: "✓",
  error: "✕",
} as const;

export function ToolCallTrace({ call }: { call: ToolCallIndicator }) {
  const args = call.arguments && Object.keys(call.arguments).length > 0
    ? Object.entries(call.arguments)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(" ")
    : "";

  return (
    <div className="font-mono text-[11px] text-ink-300 flex items-center gap-2 border-l-2 hairline-strong pl-3 py-1">
      <span className={STATUS_COLOR[call.status]}>{STATUS_GLYPH[call.status]}</span>
      <span className="text-ink-400">tool</span>
      <span className="text-ink-100">{call.name}</span>
      {args && <span className="text-ink-500 truncate">{args}</span>}
    </div>
  );
}
