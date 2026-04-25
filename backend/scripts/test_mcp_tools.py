"""Smoke test for the MCP tools (Session 3).

Exercises each of the 4 tools end-to-end against the real DB and the
TTL-cached CierreReport. No assertions — prints compact results so a
human can eyeball correctness.

Run via:
    uv run python -m scripts.test_mcp_tools
    uv run python -m scripts.test_mcp_tools 956 2025-11
"""
from __future__ import annotations

import json
import sys
import time

from mcp_server.tools import (
    get_category_shrinkage,
    get_cierre_summary,
    get_product_history,
    get_top_anomalies,
)

DEFAULT_EMPRESA = 956
DEFAULT_PERIODO = "2025-12"


def _banner(title: str) -> None:
    print(f"\n─── {title} " + "─" * max(0, 60 - len(title)))


def _time(label: str, fn, *args, **kwargs):
    t0 = time.perf_counter()
    out = fn(*args, **kwargs)
    dt = (time.perf_counter() - t0) * 1000
    print(f"[{label}] {dt:7.1f} ms")
    return out


def main() -> int:
    idempresa = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_EMPRESA
    periodo = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PERIODO

    print(f"\nTesting MCP tools against empresa={idempresa} periodo={periodo}")
    print("(first call builds + caches the CierreReport; later calls are fast)")

    # 1. get_cierre_summary -- also warms the cache.
    _banner("get_cierre_summary")
    summary = _time("get_cierre_summary", get_cierre_summary, idempresa, periodo)
    if "error" in summary:
        print(f"  error: {summary}")
        return 1
    kpis = summary["kpis"]
    print(f"  almacenes           : {kpis['num_almacenes']:,}")
    print(f"  productos           : {kpis['num_productos']:,}")
    print(f"  total importe       : ${kpis['total_importe_fisico_mxn']:>16,.2f} MXN")
    print(f"  total faltantes     : ${kpis['total_faltantes_mxn']:>16,.2f} MXN")
    print(f"  top categoria       : {kpis['top_categoria_faltante']}")
    print(f"  % líneas con merma  : {kpis['pct_lineas_con_merma']*100:.2f}%")
    print(f"  anomalías totales   : {summary['total_anomalies_found']:,}")
    if summary.get("data_quality_warnings"):
        for w in summary["data_quality_warnings"]:
            print(f"  warn: {w}")

    # 2. get_top_anomalies (should be cache hit → fast).
    _banner("get_top_anomalies (n=5)")
    tops = _time("get_top_anomalies", get_top_anomalies, idempresa, periodo, 5)
    if "error" in tops:
        print(f"  error: {tops}")
        return 1
    for i, a in enumerate(tops["anomalies"], 1):
        merma = a.get("merma_rate")
        merma_s = f"{merma*100:.1f}%" if merma is not None else "—"
        z = a.get("z_score")
        z_s = f"{z:.2f}" if z is not None else "—"
        prod = (a["producto_nombre"] or "")[:28]
        alm = (a["almacen_nombre"] or "")[:22]
        print(
            f"  {i}. [{a['severity_label']:>7}] score={a['priority_score']:5.1f}  "
            f"{prod:<28} · {alm:<22}  merma={merma_s:>7} z={z_s:>6}  "
            f"${a['financial_impact_mxn']:>14,.2f}"
        )

    # 3. get_product_history on the top anomaly's (producto, almacen).
    _banner("get_product_history (top anomaly)")
    if tops["anomalies"]:
        first = tops["anomalies"][0]
        hist = _time(
            "get_product_history",
            get_product_history,
            first["idproducto"],
            first["idalmacen"],
            12,
        )
        if "error" in hist:
            print(f"  error: {hist}")
        else:
            print(
                f"  producto={first['producto_nombre']!r} almacen={first['almacen_nombre']!r}"
            )
            print(f"  n_periodos={hist['n_periods']}  "
                  f"mean={hist['mean_merma_rate']:.4f}  "
                  f"std={hist['std_merma_rate']:.4f}")
            for p in hist["points"]:
                mr = p["merma_rate"]
                zz = p["z_score"]
                mr_s = f"{mr*100:6.2f}%" if mr is not None else "    —  "
                zz_s = f"{zz:6.2f}" if zz is not None else "   —  "
                print(
                    f"    {p['periodo']}  merma={mr_s}  z={zz_s}  "
                    f"impacto=${p['financial_impact_mxn']:>12,.2f}"
                )
            if hist.get("data_quality_warnings"):
                for w in hist["data_quality_warnings"]:
                    print(f"  warn: {w}")
    else:
        print("  (no anomalies to drill into)")

    # 4. get_category_shrinkage, top-level then drill-down.
    _banner("get_category_shrinkage (top-level)")
    cats = _time("get_category_shrinkage", get_category_shrinkage, idempresa, periodo)
    if "error" in cats:
        print(f"  error: {cats}")
    else:
        print(f"  total merma: ${cats['total_merma_mxn']:,.2f} MXN")
        for r in cats["breakdown"][:6]:
            print(
                f"    {r['categoria']:<30} {r['pct_del_total']*100:5.1f}%  "
                f"${r['total_merma_mxn']:>14,.2f}  ({r['num_productos']} prod)"
            )

        # Drill into the biggest category if we got one with idcategoria.
        top_row = next(
            (r for r in cats["breakdown"] if r.get("idcategoria")),
            None,
        )
        if top_row:
            _banner(f"get_category_shrinkage (drill idcategoria={top_row['idcategoria']})")
            drill = _time(
                "get_category_shrinkage",
                get_category_shrinkage,
                idempresa,
                periodo,
                top_row["idcategoria"],
            )
            if "error" in drill:
                print(f"  error: {drill}")
            else:
                for r in drill["breakdown"][:6]:
                    print(
                        f"    {r['categoria']} › {r['subcategoria']:<25}  "
                        f"{r['pct_del_total']*100:5.1f}%  "
                        f"${r['total_merma_mxn']:>14,.2f}"
                    )

    # 5. Error paths.
    _banner("error paths")
    bad_empresa = get_cierre_summary(-1, periodo)
    print(f"  empresa=-1             → {json.dumps(bad_empresa, ensure_ascii=False)[:100]}")
    bad_periodo = get_cierre_summary(idempresa, "1999-01")
    print(f"  periodo=1999-01        → {json.dumps(bad_periodo, ensure_ascii=False)[:100]}")

    print("\n[ok] MCP tools responded without exceptions.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
