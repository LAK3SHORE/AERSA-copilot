// Spanish-locale formatters tuned for the audit context. Numbers use
// Spanish thousands/decimals (1.234,56). Currency strings always carry an
// explicit "MXN" suffix per CLAUDE.md §15.

const NUM = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const NUM2 = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return NUM.format(n);
}

export function fmtMxn(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${NUM2.format(n)} MXN`;
}

export function fmtMxnCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M MXN`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K MXN`;
  return `$${NUM2.format(n)} MXN`;
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtZ(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `z=${n.toFixed(2)}`;
}

export function fmtPeriodo(periodo: string): string {
  // "2025-12" → "DIC 2025"
  const [y, m] = periodo.split("-");
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] ?? m} ${y}`;
}
