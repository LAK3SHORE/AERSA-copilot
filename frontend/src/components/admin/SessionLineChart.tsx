export function SessionLineChart({ data }: { data: number[] }) {
  const W = 400;
  const H = 72;
  const pL = 6;
  const pR = 6;
  const pT = 8;
  const pB = 18;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: pL + (i / Math.max(data.length - 1, 1)) * cW,
    y: pT + (1 - v / max) * cH,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]?.x.toFixed(1) ?? pL},${pT + cH} L${pL},${pT + cH} Z`;
  const xLabs = [0, 5, 10, 15, 20, 25, 29].map((i) => ({
    i,
    x: pL + (i / Math.max(data.length - 1, 1)) * cW,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#84AC37" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#84AC37" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.5, 1, 2, 3]
        .filter((v) => v <= max)
        .map((v) => {
          const y = pT + (1 - v / max) * cH;
          return (
            <line
              key={v}
              x1={pL}
              y1={y}
              x2={W - pR}
              y2={y}
              stroke="rgba(132,172,55,0.07)"
              strokeWidth="0.5"
            />
          );
        })}
      <path d={area} fill="url(#sg)" />
      <path d={line} fill="none" stroke="#84AC37" strokeWidth="1.2" strokeLinejoin="round" />
      {pts.map((p, i) =>
        data[i] > 0 ? <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#84AC37" /> : null,
      )}
      {xLabs.map(({ i, x }) => (
        <text
          key={i}
          x={x}
          y={H - 2}
          textAnchor="middle"
          fontFamily="IBM Plex Mono"
          fontSize="7"
          fill="rgba(51,51,51,0.32)"
        >
          D{i + 1}
        </text>
      ))}
    </svg>
  );
}
