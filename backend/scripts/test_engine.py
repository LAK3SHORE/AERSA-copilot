"""End-to-end smoke test for the analytical engine.

Run via:
    uv run python -m scripts.test_engine             # default: empresa 956, 2025-12
    uv run python -m scripts.test_engine 956 2025-11

Prints the KPI summary and the top 10 anomalies. No assertions — this is
for eyeballing whether the rankings look sensible on real data.
"""
from __future__ import annotations

import sys
import time

from engine.report import build_cierre_report

DEFAULT_EMPRESA = 956
DEFAULT_PERIODO = "2025-12"


def fmt_mxn(x: float | None) -> str:
    if x is None:
        return "—"
    return f"${x:>16,.2f} MXN"


def fmt_pct(x: float | None) -> str:
    if x is None:
        return "—"
    return f"{x * 100:6.2f}%"


def main() -> int:
    idempresa = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_EMPRESA
    periodo = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PERIODO

    print(f"\n[engine] Building Cierre report · empresa={idempresa} · periodo={periodo}")
    t0 = time.perf_counter()
    report = build_cierre_report(idempresa, periodo, top_n=10)
    elapsed = time.perf_counter() - t0
    print(f"[engine] Done in {elapsed:.2f}s\n")

    k = report.kpis
    print("─── KPI Summary ─────────────────────────────────────────────")
    print(f"  Almacenes activos          : {k.num_almacenes:>6,}")
    print(f"  Productos auditados        : {k.num_productos:>6,}")
    print(f"  Líneas en el Cierre        : {k.num_lineas:>6,}")
    print(f"  Importe físico total       : {fmt_mxn(k.total_importe_fisico_mxn)}")
    print(f"  Faltantes (merma)          : {fmt_mxn(k.total_faltantes_mxn)}")
    print(f"  Sobrantes                  : {fmt_mxn(k.total_sobrantes_mxn)}")
    print(f"  Compras (unidades)         : {k.total_compras_unidades:>16,.0f}")
    print(f"  Ventas (unidades)          : {k.total_ventas_unidades:>16,.0f}")
    print(f"  % líneas con merma         : {fmt_pct(k.pct_lineas_con_merma)}")
    print(f"  Top categoría con faltante : {k.top_categoria_faltante}")

    print("\n─── Top 10 hallazgos por priority_score ─────────────────────")
    print(
        f"{'#':>2} {'sev':>7} {'score':>5}  "
        f"{'producto':<32} {'almacen':<24} "
        f"{'merma%':>8} {'z':>6}  {'impacto':>20}"
    )
    print("-" * 120)
    for i, a in enumerate(report.top_anomalies, 1):
        producto = (a.producto_nombre or "")[:30]
        almacen = (a.almacen_nombre or "")[:22]
        merma = fmt_pct(a.merma_rate)
        z = f"{a.z_score:>6.2f}" if a.z_score is not None else "   —  "
        print(
            f"{i:>2} {a.severity_label:>7} {a.priority_score:>5.1f}  "
            f"{producto:<32} {almacen:<24} "
            f"{merma:>8} {z}  {fmt_mxn(a.financial_impact_mxn)}"
        )

    print(f"\n[engine] total anomalies (z>2 OR iqr) : {report.total_anomalies_found:,}")
    print(f"[engine] generated_at                  : {report.generated_at}")
    if report.data_quality_warnings:
        print("[engine] data quality warnings:")
        for w in report.data_quality_warnings:
            print(f"  - {w}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
