export function McpBarsChart({
  data,
  onSelect,
}: {
  data: { id: string; nombre: string; llamadas: number }[];
  onSelect?: (id: string) => void;
}) {
  const max = data[0]?.llamadas ?? 1;

  return (
    <div>
      {data.map((item) => {
        const inner = (
          <>
            <div className="font-mono text-[10px] text-ink w-[180px] truncate shrink-0 group-hover:text-ink">
              {item.nombre}
            </div>
            <div className="flex-1 h-1 bg-accent/10 relative">
              <div
                className="absolute left-0 top-0 h-full bg-accent transition-all duration-500 group-hover:bg-accent-2"
                style={{ width: `${(item.llamadas / max) * 100}%` }}
              />
            </div>
            <div className="font-mono text-[10px] text-ink-3 w-[22px] text-right shrink-0">
              {item.llamadas}
            </div>
          </>
        );

        if (onSelect) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="group flex items-center gap-2.5 mb-2 w-full text-left border-0 bg-transparent p-0 cursor-pointer hover:opacity-90"
              title="Preguntar al copiloto sobre esta herramienta"
            >
              {inner}
            </button>
          );
        }

        return (
          <div key={item.id} className="flex items-center gap-2.5 mb-2">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
