import type { FindingStatus } from "../../types/cierre";

const COLS: Record<string, string> = {
  pendiente: "rgba(51,51,51,0.55)",
  revisado: "#84AC37",
  escalado: "#9C7E10",
};

const LABEL: Record<FindingStatus, string> = {
  pendiente: "PENDIENTE",
  revisado: "REVISADO",
  escalado: "ESCALADO",
};

export function EstatusSelect({
  value,
  onChange,
}: {
  value: FindingStatus;
  onChange: (v: FindingStatus) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        e.stopPropagation();
        onChange(e.target.value as FindingStatus);
      }}
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-[10px] tracking-widish px-1.5 py-0.5 border border-accent-3 bg-cream-2 cursor-pointer outline-none"
      style={{ color: COLS[value] ?? "var(--ink)" }}
    >
      {(Object.keys(LABEL) as FindingStatus[]).map((o) => (
        <option key={o} value={o}>
          {LABEL[o]}
        </option>
      ))}
    </select>
  );
}
