import type { SeverityLabel } from "../../types/cierre";

const SEV_CFG: Record<SeverityLabel, { color: string; bg: string }> = {
  CRÍTICO: { color: "#B83025", bg: "rgba(184,48,37,0.09)" },
  ALTO: { color: "#C26020", bg: "rgba(194,96,32,0.09)" },
  MEDIO: { color: "#9C7E10", bg: "rgba(156,126,16,0.09)" },
  BAJO: { color: "#5E7B5A", bg: "rgba(94,123,90,0.09)" },
};

export function SeverityBadge({ level }: { level: SeverityLabel }) {
  const s = SEV_CFG[level] ?? SEV_CFG.BAJO;
  return (
    <span
      className="font-mono text-[10px] font-medium tracking-widish px-1.5 py-0.5 shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      {level}
    </span>
  );
}
