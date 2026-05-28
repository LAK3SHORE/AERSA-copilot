export function McpBarsChart({
  data,
}: {
  data: { nombre: string; llamadas: number }[];
}) {
  const max = data[0]?.llamadas ?? 1;
  return (
    <div>
      {data.map((item) => (
        <div key={item.nombre} className="flex items-center gap-2.5 mb-2">
          <div className="font-mono text-[10px] text-ink-2 w-[180px] truncate shrink-0">
            {item.nombre}
          </div>
          <div className="flex-1 h-1 bg-accent/10 relative">
            <div
              className="absolute left-0 top-0 h-full bg-accent transition-all duration-500"
              style={{ width: `${(item.llamadas / max) * 100}%` }}
            />
          </div>
          <div className="font-mono text-[10px] text-ink-3 w-[22px] text-right shrink-0">
            {item.llamadas}
          </div>
        </div>
      ))}
    </div>
  );
}
