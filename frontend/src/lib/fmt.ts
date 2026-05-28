/** Spanish-locale formatters (prototype talos-components). */

const NUM = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const NUM2 = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const mxn = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(v)) return "—";
  return `$${NUM2.format(v)} MXN`;
};

export const num = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(v)) return "—";
  return NUM.format(v);
};

export const pct = (v: number | null | undefined, fromRatio = false): string => {
  if (v == null || Number.isNaN(v)) return "—";
  const n = fromRatio ? v * 100 : v;
  return `${n.toFixed(1)}%`;
};

export const short = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(v)) return "—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${(v / 1e3).toFixed(1)}K`;
};

export const fmtPeriodo = (periodo: string): string => {
  const [y, m] = periodo.split("-");
  const months = [
    "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
  ];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] ?? m} ${y}`;
};
