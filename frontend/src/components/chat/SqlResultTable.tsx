const DEFAULT_PREVIEW_ROWS = 20;

export function SqlResultTable({
  columns,
  rows,
  rowCount,
  maxRows = DEFAULT_PREVIEW_ROWS,
}: {
  columns: string[];
  rows: unknown[][];
  rowCount?: number;
  maxRows?: number;
}) {
  if (!columns.length) {
    return (
      <p className="font-mono text-[10px] text-ink-4 py-2">Sin columnas en el resultado.</p>
    );
  }

  if (!rows.length) {
    return (
      <p className="font-mono text-[10px] text-crit/90 py-2 border border-crit/20 bg-crit/5 px-2">
        La consulta no devolvió filas. Revisa filtros (almacén, merma con diferencia &lt; 0,
        ABS(dif_importe)) o el período cargado.
      </p>
    );
  }

  const preview = rows.slice(0, maxRows);
  const total = rowCount ?? rows.length;

  return (
    <div className="overflow-x-auto mt-1.5">
      <table className="w-full border-collapse font-mono text-[10px]">
        <thead>
          <tr>
            {columns.map((h) => (
              <th
                key={h}
                className="px-2 py-1 text-left border-b border-accent-3 text-ink-3 font-normal tracking-widish"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((r, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-accent/7" : ""}>
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1 text-ink">
                  {formatCell(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {total > preview.length && (
        <p className="font-mono text-[9px] text-ink-4 mt-1">
          Mostrando {preview.length} de {total} filas
        </p>
      )}
    </div>
  );
}

function formatCell(c: unknown): string {
  if (c == null) return "—";
  if (typeof c === "number") {
    return Number.isInteger(c) ? String(c) : c.toLocaleString("es-MX", { maximumFractionDigits: 4 });
  }
  return String(c);
}
