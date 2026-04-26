"""CierreReport assembler (CLAUDE.md 6.4).

The CierreReport is the single source of truth for a (empresa, periodo)
session. It bundles the KPI summary and the top-N anomalies into one
structured payload that the API and MCP tools serialize to JSON.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

import pandas as pd

from db.queries.cierre import fetch_kpi_row, fetch_lines, fetch_top_categoria_faltante
from engine.anomaly import annotate_lines, compute_baseline
from engine.cleaning import filter_lines
from engine.scoring import compute_priority_scores


@dataclass
class KPISummary:
    idempresa: int
    periodo: str
    num_almacenes: int
    num_productos: int
    num_lineas: int
    total_importe_fisico_mxn: float
    total_faltantes_mxn: float
    total_sobrantes_mxn: float
    total_compras_unidades: float
    total_ventas_unidades: float
    top_categoria_faltante: str
    pct_lineas_con_merma: float


@dataclass
class AnomalyRecord:
    idinventariomesdetalle: int
    idproducto: int
    producto_nombre: str
    idcategoria: int | None
    categoria_nombre: str
    subcategoria_nombre: str
    idalmacen: int
    almacen_nombre: str
    idsucursal: int
    periodo: str
    merma_rate: float | None
    z_score: float | None
    financial_impact_mxn: float
    priority_score: float
    severity_label: str
    mean_merma_rate_hist: float | None
    recurrence_count: int
    unidad_medida: str


@dataclass
class CierreReport:
    idempresa: int
    periodo: str
    generated_at: str
    kpis: KPISummary
    top_anomalies: list[AnomalyRecord]
    total_anomalies_found: int
    data_quality_warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        # Make sure NaN floats become None for JSON-friendliness later.
        return _scrub_nan(d)


def _scrub_nan(obj):
    if isinstance(obj, dict):
        return {k: _scrub_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_scrub_nan(v) for v in obj]
    if isinstance(obj, float) and (obj != obj):  # NaN check
        return None
    return obj


def _build_kpi(idempresa: int, periodo: str) -> KPISummary:
    row = fetch_kpi_row(idempresa, periodo)
    top = fetch_top_categoria_faltante(idempresa, periodo)
    top_label = (
        f"{top['categoria']} > {top['subcategoria']}"
        if top else "—"
    )
    return KPISummary(
        idempresa=idempresa,
        periodo=periodo,
        num_almacenes=int(row.get("num_almacenes") or 0),
        num_productos=int(row.get("num_productos") or 0),
        num_lineas=int(row.get("num_lineas") or 0),
        total_importe_fisico_mxn=float(row.get("total_importe_fisico_mxn") or 0.0),
        total_faltantes_mxn=float(row.get("total_faltantes_mxn") or 0.0),
        total_sobrantes_mxn=float(row.get("total_sobrantes_mxn") or 0.0),
        total_compras_unidades=float(row.get("total_compras_unidades") or 0.0),
        total_ventas_unidades=float(row.get("total_ventas_unidades") or 0.0),
        top_categoria_faltante=top_label,
        pct_lineas_con_merma=float(row.get("pct_lineas_con_merma") or 0.0),
    )


def _row_to_anomaly(r: pd.Series, periodo: str) -> AnomalyRecord:
    def f(x):
        if x is None or (isinstance(x, float) and x != x):
            return None
        return float(x)

    return AnomalyRecord(
        idinventariomesdetalle=int(r["idinventariomesdetalle"]),
        idproducto=int(r["idproducto"]),
        producto_nombre=str(r["producto_nombre"]),
        idcategoria=int(r["idcategoria"]) if pd.notna(r["idcategoria"]) else None,
        categoria_nombre=str(r["categoria_nombre"]),
        subcategoria_nombre=str(r["subcategoria_nombre"]),
        idalmacen=int(r["idalmacen"]),
        almacen_nombre=str(r["almacen_nombre"]),
        idsucursal=int(r["idsucursal"]),
        periodo=periodo,
        merma_rate=f(r.get("merma_rate")),
        z_score=f(r.get("z_score")),
        financial_impact_mxn=f(r.get("financial_impact_mxn")) or 0.0,
        priority_score=f(r.get("priority_score")) or 0.0,
        severity_label=str(r["severity_label"]),
        mean_merma_rate_hist=f(r.get("mean_merma_rate_hist")),
        recurrence_count=int(r.get("recurrence_count") or 0),
        unidad_medida=str(r.get("unidad_medida") or "—"),
    )


def build_cierre_report(
    idempresa: int,
    periodo: str,
    top_n: int = 20,
) -> CierreReport:
    """End-to-end: pull lines + baseline → score → return the report."""
    warnings: list[str] = []

    raw_lines = fetch_lines(idempresa, periodo)
    if raw_lines.empty:
        return CierreReport(
            idempresa=idempresa,
            periodo=periodo,
            generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            kpis=_build_kpi(idempresa, periodo),
            top_anomalies=[],
            total_anomalies_found=0,
            data_quality_warnings=["no_lines_for_period"],
        )

    lines = filter_lines(raw_lines)
    rows_filtered = len(raw_lines) - len(lines)
    if rows_filtered > 0:
        warnings.append(f"{rows_filtered:,} líneas filtradas como outliers")

    baseline_stats, baseline_obs = compute_baseline(idempresa, periodo)
    annotated = annotate_lines(lines, baseline_stats, baseline_obs)

    n_no_baseline = int((~annotated["has_baseline"]).sum())
    if n_no_baseline:
        from config import settings as _s

        warnings.append(
            f"{n_no_baseline:,} líneas sin historia suficiente "
            f"(<{_s.anomaly_min_history_periods} periodos)"
        )

    scored = compute_priority_scores(annotated)

    # Total "real" anomalies = lines with z>soft OR iqr_outlier OR
    # (no baseline but merma_rate is meaningfully positive).
    total_anomalies = int(
        (
            (scored["z_score"].fillna(0) > 2.0)
            | scored["iqr_outlier"].fillna(False)
        ).sum()
    )

    top = (
        scored.sort_values("priority_score", ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )
    top_records = [_row_to_anomaly(r, periodo) for _, r in top.iterrows()]

    return CierreReport(
        idempresa=idempresa,
        periodo=periodo,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        kpis=_build_kpi(idempresa, periodo),
        top_anomalies=top_records,
        total_anomalies_found=total_anomalies,
        data_quality_warnings=warnings,
    )


__all__ = [
    "CierreReport",
    "KPISummary",
    "AnomalyRecord",
    "build_cierre_report",
]
