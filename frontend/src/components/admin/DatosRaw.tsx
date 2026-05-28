import { useEffect, useMemo, useState } from "react";
import { fetchCompanies } from "../../api/companies";
import { fetchPeriods } from "../../api/periods";
import { fetchRawCierre } from "../../api/raw";
import type { AppShellContext } from "../AppShell";
import type { RawRow } from "../../types/raw";
import type { Company } from "../../types";
import { Eyebrow } from "../shared/Eyebrow";

function matchNum(val: number, expr: string): boolean {
  const s = expr.trim();
  if (!s) return true;
  const m = s.match(/^([><=!]{0,2})\s*(-?[\d.]+)$/);
  if (!m) return true;
  const [, op, num] = m;
  const n = parseFloat(num);
  if (op === ">") return val > n;
  if (op === "<") return val < n;
  if (op === ">=") return val >= n;
  if (op === "<=") return val <= n;
  if (op === "=" || op === "==") return val === n;
  if (op === "!=") return val !== n;
  return val >= n;
}

const COLS = [
  { key: "idalmacen" as const, label: "ID ALM", type: "num" as const, align: "left" as const },
  { key: "almacen" as const, label: "ALMACÉN", type: "str" as const, align: "left" as const },
  { key: "idprod" as const, label: "ID PROD", type: "num" as const, align: "left" as const },
  { key: "producto" as const, label: "PRODUCTO", type: "str" as const, align: "left" as const },
  { key: "cat" as const, label: "CATEGORÍA", type: "str" as const, align: "left" as const },
  { key: "sf" as const, label: "STOCK FÍS", type: "num" as const, align: "right" as const },
  { key: "st" as const, label: "STOCK TEÓ", type: "num" as const, align: "right" as const },
  { key: "d" as const, label: "DELTA", type: "num" as const, align: "right" as const },
  { key: "mp" as const, label: "MERMA %", type: "num" as const, align: "right" as const },
  { key: "mxn" as const, label: "IMPORTE", type: "num" as const, align: "right" as const },
  { key: "z" as const, label: "Z-SCORE", type: "num" as const, align: "right" as const },
];

export function DatosRaw({ shell }: { shell: AppShellContext }) {
  const [empresas, setEmpresas] = useState<Company[]>([]);
  const [empresa, setEmpresa] = useState("");
  const [cierre, setCierre] = useState("");
  const [tabla, setTabla] = useState("cierre_detalle");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<string[]>([]);
  const [colFilters, setColFilters] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    COLS.forEach((c) => {
      m[c.key] = "";
    });
    return m;
  });

  useEffect(() => {
    fetchCompanies(20).then(setEmpresas).catch(() => {});
  }, []);

  useEffect(() => {
    if (!empresa) return;
    fetchPeriods(Number(empresa)).then(setPeriods).catch(() => setPeriods([]));
  }, [empresa]);

  const handleLoad = async () => {
    if (!empresa || !cierre) return;
    setLoading(true);
    try {
      const res = await fetchRawCierre(Number(empresa), cierre, tabla);
      setRows(res.rows);
      setTotalRows(res.total_rows);
      setLoaded(true);
      shell.setSqlContext({
        idempresa: Number(empresa),
        periodo: cierre,
        tabla,
      });
      shell.openChat(
        `¿Cuáles son los productos con más merma en Empresa ${empresa} período ${cierre}?`,
        "sql",
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!loaded) return [];
    return rows.filter((row) => {
      for (const col of COLS) {
        const expr = colFilters[col.key];
        if (!expr) continue;
        const val = row[col.key];
        if (col.type === "str") {
          if (!String(val).toLowerCase().includes(expr.toLowerCase())) return false;
        } else if (!matchNum(Number(val), expr)) {
          return false;
        }
      }
      return true;
    });
  }, [loaded, rows, colFilters]);

  const hasFilters = Object.values(colFilters).some((v) => v !== "");
  const clearFilters = () => {
    const m: Record<string, string> = {};
    COLS.forEach((c) => {
      m[c.key] = "";
    });
    setColFilters(m);
  };

  const selClass =
    "font-mono text-[11px] px-2 py-1 border border-accent-3 bg-cream-2 text-ink outline-none cursor-pointer";

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-7 py-3 border-b border-accent-3 bg-cream-2 shrink-0">
        <Eyebrow>Datos Raw</Eyebrow>
        <div className="w-px h-4 bg-accent-3" />
        <select
          value={empresa}
          onChange={(e) => {
            setEmpresa(e.target.value);
            setCierre("");
            setLoaded(false);
            clearFilters();
          }}
          className={selClass}
        >
          <option value="">— Empresa —</option>
          {empresas.map((e) => (
            <option key={e.idempresa} value={e.idempresa}>
              {e.nombre}
            </option>
          ))}
        </select>
        <select
          value={cierre}
          onChange={(e) => {
            setCierre(e.target.value);
            setLoaded(false);
          }}
          disabled={!empresa}
          className={`${selClass} disabled:opacity-50`}
        >
          <option value="">— Período —</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={tabla} onChange={(e) => setTabla(e.target.value)} className={selClass}>
          <option value="cierre_detalle">cierre_detalle</option>
        </select>
        <button
          type="button"
          disabled={!empresa || !cierre || loading}
          onClick={() => void handleLoad()}
          className="font-mono text-[10px] tracking-widish px-3.5 py-1.5 border border-accent-3 disabled:opacity-40 enabled:bg-accent enabled:text-ink cursor-pointer"
        >
          {loading ? "CARGANDO…" : "CARGAR DATOS"}
        </button>
        {loaded && (
          <span className="font-mono text-[9.5px] text-ink-4">
            {tabla} · <strong className="text-ink">{filteredRows.length}</strong> / {totalRows}{" "}
            filas
          </span>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="font-mono text-[9.5px] px-2 py-1 border border-accent-3 text-ink-3 hover:bg-accent/10"
          >
            × limpiar filtros
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-7 pb-4">
        {!loaded ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-5 font-mono text-[11px] tracking-widish gap-2">
            <span className="text-xl opacity-40">⊞</span>
            Selecciona empresa y cierre para cargar datos
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-[10.5px]">
            <thead className="sticky top-0 bg-cream-2 z-[2]">
              <tr>
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2.5 pt-2 pb-1 border-b border-accent-3 text-ink-3 font-normal tracking-widish text-[9.5px] whitespace-nowrap ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
              <tr>
                {COLS.map((col) => {
                  const active = colFilters[col.key] !== "";
                  return (
                    <th key={col.key} className="px-1.5 pb-1.5 border-b-2 border-accent-3">
                      <input
                        value={colFilters[col.key]}
                        onChange={(e) =>
                          setColFilters((prev) => ({ ...prev, [col.key]: e.target.value }))
                        }
                        placeholder={col.type === "num" ? ">0" : "…"}
                        className={`w-full font-mono text-[9.5px] px-1 py-0.5 border outline-none ${
                          active ? "border-accent-2/40 bg-accent/10" : "border-ink/10 bg-accent/10"
                        }`}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} className="py-6 text-center text-ink-5 text-[10px]">
                    SIN RESULTADOS · ajusta los filtros
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-accent-3 ${i % 2 === 1 ? "bg-accent/7" : ""}`}
                  >
                    <td className="px-2.5 py-1 text-ink-3">{row.idalmacen}</td>
                    <td className="px-2.5 py-1">{row.almacen}</td>
                    <td className="px-2.5 py-1 text-ink-3">{row.idprod}</td>
                    <td className="px-2.5 py-1 max-w-[200px] truncate">{row.producto}</td>
                    <td className="px-2.5 py-1 text-ink-2">{row.cat}</td>
                    <td className="px-2.5 py-1 text-right">{row.sf.toFixed(2)}</td>
                    <td className="px-2.5 py-1 text-right">{row.st.toFixed(2)}</td>
                    <td
                      className="px-2.5 py-1 text-right font-medium"
                      style={{ color: row.d < 0 ? "#B83025" : "#5E7B5A" }}
                    >
                      {row.d.toFixed(2)}
                    </td>
                    <td
                      className="px-2.5 py-1 text-right"
                      style={{ color: row.mp > 50 ? "#C26020" : undefined }}
                    >
                      {row.mp.toFixed(1)}%
                    </td>
                    <td className="px-2.5 py-1 text-right">
                      ${row.mxn.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-1 text-right text-ink-2">{row.z.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
