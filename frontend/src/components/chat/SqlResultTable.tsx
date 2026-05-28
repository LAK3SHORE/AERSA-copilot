export function SqlResultTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: unknown[][];
}) {
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
          {rows.map((r, i) => (
            <tr
              key={i}
              className={i % 2 === 1 ? "bg-accent/7" : ""}
            >
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1 text-ink">
                  {String(c ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
