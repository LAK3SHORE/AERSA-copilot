import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryBreakdownRow, AlmacenBreakdownRow } from "../../../types/report";
import { mxn } from "../../../lib/fmt";

const SEV_COLORS: Record<string, string> = {
  CRÍTICO: "#B83025",
  ALTO: "#C26020",
  MEDIO: "#9C7E10",
  BAJO: "#5E7B5A",
};

const tooltipStyle = {
  fontSize: 11,
  fontFamily: '"IBM Plex Mono", monospace',
};

export function CategoryBarChart({ data }: { data: CategoryBreakdownRow[] }) {
  const rows = data.slice(0, 10).map((r) => ({
    name: r.categoria.length > 22 ? `${r.categoria.slice(0, 20)}…` : r.categoria,
    full: r.categoria,
    merma: r.total_merma_mxn,
    pct: r.pct_del_total,
  }));

  if (!rows.length) {
    return <p className="font-mono text-[10px] text-ink-3 py-6 text-center">Sin faltantes por categoría</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 28)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 9, fill: "#666" }} tickFormatter={(v) => shortMxn(v)} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9, fill: "#444" }} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [mxn(v), "Faltante"]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
        />
        <Bar dataKey="merma" fill="#84AC37" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AlmacenBarChart({ data }: { data: AlmacenBreakdownRow[] }) {
  const rows = data.slice(0, 10).map((r) => ({
    name: r.almacen.length > 22 ? `${r.almacen.slice(0, 20)}…` : r.almacen,
    full: r.almacen,
    merma: r.total_merma_mxn,
  }));

  if (!rows.length) {
    return <p className="font-mono text-[10px] text-ink-3 py-6 text-center">Sin faltantes por almacén</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 28)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 9, fill: "#666" }} tickFormatter={(v) => shortMxn(v)} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9, fill: "#444" }} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [mxn(v), "Faltante"]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
        />
        <Bar dataKey="merma" fill="#869C4E" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SeverityPieChart({ counts }: { counts: Record<string, number> }) {
  const order = ["CRÍTICO", "ALTO", "MEDIO", "BAJO"];
  const data = order
    .map((name) => ({ name, value: counts[name] ?? 0 }))
    .filter((d) => d.value > 0);

  if (!data.length) {
    return <p className="font-mono text-[10px] text-ink-3 py-6 text-center">Sin hallazgos en el top</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={72}
          paddingAngle={2}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={SEV_COLORS[d.name] ?? "#999"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, name: string) => [`${v} hallazgos`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function shortMxn(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

export function SeverityLegend({ counts }: { counts: Record<string, number> }) {
  const order = ["CRÍTICO", "ALTO", "MEDIO", "BAJO"];
  return (
    <div className="flex flex-wrap gap-3 justify-center mt-2">
      {order.map((sev) => {
        const n = counts[sev] ?? 0;
        if (n === 0) return null;
        return (
          <span key={sev} className="font-mono text-[10px] text-ink flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: SEV_COLORS[sev] }}
            />
            {sev}: {n}
          </span>
        );
      })}
    </div>
  );
}
