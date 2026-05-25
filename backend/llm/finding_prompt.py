"""User-message enrichment when the auditor clicks a known hallazgo."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class FindingContext:
    idinventariomesdetalle: int
    idproducto: int
    idalmacen: int
    producto_nombre: str
    almacen_nombre: str
    severity_label: str | None = None


def build_finding_user_message(
    *,
    idempresa: int,
    periodo: str,
    finding: FindingContext,
    natural_question: str | None = None,
) -> str:
    """Append structured IDs so the agent calls tools without asking the auditor."""
    question = natural_question or (
        f'Explícame el hallazgo de "{finding.producto_nombre}" en el almacén '
        f'"{finding.almacen_nombre}". ¿Por qué es anómalo, qué impacto tiene '
        f"y qué debería revisar?"
    )
    sev = finding.severity_label or "—"
    return (
        f"{question}\n\n"
        "[Contexto del hallazgo — Cierre activo en pantalla]\n"
        f"- Empresa idempresa: {idempresa}\n"
        f"- Periodo: {periodo}\n"
        f"- idinventariomesdetalle: {finding.idinventariomesdetalle}\n"
        f"- idproducto: {finding.idproducto}\n"
        f"- idalmacen: {finding.idalmacen}\n"
        f"- Producto: {finding.producto_nombre}\n"
        f"- Almacén: {finding.almacen_nombre}\n"
        f"- Severidad en el ranking: {sev}\n\n"
        "Instrucción para el copiloto: el auditor ya cargó este Cierre. "
        f"Llama de inmediato get_product_history(idproducto={finding.idproducto}, "
        f"idalmacen={finding.idalmacen}). "
        "No pidas confirmación de empresa, periodo ni IDs. "
        "No ofrezcas get_top_anomalies como primer paso — este hallazgo ya está identificado."
    )


__all__ = ["FindingContext", "build_finding_user_message"]
