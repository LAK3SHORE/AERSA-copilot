import type { AccionItem, Hallazgo } from "../types/cierre";

export interface FindingContextPayload {
  idinventariomesdetalle: number;
  idproducto: number;
  idalmacen: number;
  producto_nombre: string;
  almacen_nombre: string;
  severity_label?: string;
}

/** Short text shown in the chat bubble — full IDs go in finding_context. */
export function displayPromptForFinding(
  producto: string,
  almacen: string,
): string {
  return (
    `Explícame el hallazgo de "${producto}" en el almacén "${almacen}". ` +
    "¿Por qué es anómalo, qué impacto tiene y qué debería revisar?"
  );
}

export function contextFromHallazgo(a: Hallazgo): FindingContextPayload {
  return {
    idinventariomesdetalle: a.idinventariomesdetalle,
    idproducto: a.idproducto,
    idalmacen: a.idalmacen,
    producto_nombre: a.producto_nombre,
    almacen_nombre: a.almacen_nombre,
    severity_label: a.severity_label,
  };
}

/** @deprecated use contextFromHallazgo */
export const contextFromAnomaly = contextFromHallazgo;

export function contextFromBriefAction(a: AccionItem): FindingContextPayload {
  return {
    idinventariomesdetalle: a.idinventariomesdetalle,
    idproducto: a.idproducto,
    idalmacen: a.idalmacen,
    producto_nombre: a.producto_nombre,
    almacen_nombre: a.almacen_nombre,
    severity_label: a.severity_label,
  };
}
