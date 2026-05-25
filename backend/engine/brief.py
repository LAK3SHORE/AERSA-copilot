"""Guided audit briefing — \"¿Por dónde empiezo?\" (Session 11)."""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from engine.report import AnomalyRecord, CierreReport
from llm.finding_prompt import FindingContext, build_finding_user_message


def build_audit_brief(report: CierreReport, max_actions: int = 5) -> dict[str, Any]:
    """Structured briefing from a CierreReport — no LLM required for v0."""
    kpis = report.kpis
    faltante = kpis.total_faltantes_mxn
    n_crit = sum(1 for a in report.top_anomalies if a.severity_label == "CRÍTICO")
    n_alto = sum(1 for a in report.top_anomalies if a.severity_label == "ALTO")

    headline = (
        f"Faltante total {faltante:,.0f} MXN · "
        f"{report.total_anomalies_found} anomalías · "
        f"{n_crit} críticas / {n_alto} altas en el top"
    )

    summary_parts = [
        f"Cierre {report.periodo} con {kpis.num_almacenes} almacenes y {kpis.num_lineas:,} líneas.",
        f"{kpis.pct_lineas_con_merma * 100:.1f}% de líneas con merma.",
        f"La categoría con mayor faltante es {kpis.top_categoria_faltante}.",
    ]
    if report.data_quality_warnings:
        summary_parts.append(f"Advertencias: {'; '.join(report.data_quality_warnings[:2])}")

    actions = _build_actions(
        report.top_anomalies,
        max_actions,
        idempresa=report.idempresa,
        periodo=report.periodo,
    )

    return {
        "idempresa": report.idempresa,
        "periodo": report.periodo,
        "headline": headline,
        "summary": " ".join(summary_parts),
        "action_count": len(actions),
        "actions": actions,
        "total_anomalies_found": report.total_anomalies_found,
    }


def _build_actions(
    anomalies: list[AnomalyRecord],
    max_actions: int,
    *,
    idempresa: int,
    periodo: str,
) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    seen_products: set[int] = set()

    for a in anomalies:
        if a.severity_label not in ("CRÍTICO", "ALTO"):
            continue
        if a.idproducto in seen_products:
            continue
        seen_products.add(a.idproducto)
        reason_bits = [
            a.severity_label,
            f"impacto {a.financial_impact_mxn:,.0f} MXN",
        ]
        if a.z_score is not None:
            reason_bits.append(f"z={a.z_score:.1f}")
        if a.recurrence_count > 0:
            reason_bits.append(f"recurrencia {a.recurrence_count}/4")

        actions.append({
            "rank": len(actions) + 1,
            "idinventariomesdetalle": a.idinventariomesdetalle,
            "idproducto": a.idproducto,
            "idalmacen": a.idalmacen,
            "producto_nombre": a.producto_nombre,
            "almacen_nombre": a.almacen_nombre,
            "severity_label": a.severity_label,
            "priority_score": a.priority_score,
            "title": f"Revisar {a.producto_nombre}",
            "reason": " · ".join(reason_bits),
            "suggested_prompt": build_finding_user_message(
                idempresa=idempresa,
                periodo=periodo,
                finding=FindingContext(
                    idinventariomesdetalle=a.idinventariomesdetalle,
                    idproducto=a.idproducto,
                    idalmacen=a.idalmacen,
                    producto_nombre=a.producto_nombre,
                    almacen_nombre=a.almacen_nombre,
                    severity_label=a.severity_label,
                ),
            ),
            "anomaly": asdict(a),
        })
        if len(actions) >= max_actions:
            break

    if not actions and anomalies:
        a = anomalies[0]
        actions.append({
            "rank": 1,
            "idinventariomesdetalle": a.idinventariomesdetalle,
            "idproducto": a.idproducto,
            "idalmacen": a.idalmacen,
            "producto_nombre": a.producto_nombre,
            "almacen_nombre": a.almacen_nombre,
            "severity_label": a.severity_label,
            "priority_score": a.priority_score,
            "title": f"Revisar {a.producto_nombre}",
            "reason": f"Mayor prioridad en el ranking (score {a.priority_score:.1f})",
            "suggested_prompt": build_finding_user_message(
                idempresa=idempresa,
                periodo=periodo,
                finding=FindingContext(
                    idinventariomesdetalle=a.idinventariomesdetalle,
                    idproducto=a.idproducto,
                    idalmacen=a.idalmacen,
                    producto_nombre=a.producto_nombre,
                    almacen_nombre=a.almacen_nombre,
                    severity_label=a.severity_label,
                ),
            ),
            "anomaly": asdict(a),
        })

    return actions
