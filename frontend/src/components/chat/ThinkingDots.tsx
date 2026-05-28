export function ThinkingDots({ label = "TALOS · COPILOTO" }: { label?: string }) {
  return (
    <div className="mb-4">
      <div className="font-mono text-[9px] tracking-wide2 text-ink-4 mb-1">{label}</div>
      <div className="font-mono text-[13px] text-ink-5 tracking-[0.2em]">· · ·</div>
    </div>
  );
}
