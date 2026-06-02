import type { SqlRawRowFilter } from "./chatTypes";

export function normSqlLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const PRODUCT_ID_COLS = new Set(["idproducto", "id_prod", "idprod", "id_producto"]);
const ALMACEN_ID_COLS = new Set(["idalmacen", "id_almacen", "idalm"]);
const PRODUCT_NAME_COLS = new Set([
  "producto_nombre",
  "producto",
  "nombre_producto",
  "producto_nombre_mx",
]);
const ALMACEN_NAME_COLS = new Set(["almacen_nombre", "almacen", "nombre_almacen"]);

function colIndex(columns: string[], aliases: Set<string>): number {
  return columns.findIndex((c) => aliases.has(c.toLowerCase().replace(/\s+/g, "_")));
}

function toInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Derive Datos Raw row filters from NL→SQL result columns. */
export function buildSqlRawFilter(
  columns: string[],
  rows: unknown[][],
): SqlRawRowFilter | null {
  if (!rows.length) return null;

  const iProd = colIndex(columns, PRODUCT_ID_COLS);
  const iAlm = colIndex(columns, ALMACEN_ID_COLS);
  const iProdName = colIndex(columns, PRODUCT_NAME_COLS);
  const iAlmName = colIndex(columns, ALMACEN_NAME_COLS);

  const productIds = new Set<number>();
  const almacenIds = new Set<number>();
  const productNames = new Set<string>();
  const almacenNames = new Set<string>();

  for (const row of rows) {
    if (iProd >= 0) {
      const id = toInt(row[iProd]);
      if (id != null) productIds.add(id);
    }
    if (iAlm >= 0) {
      const id = toInt(row[iAlm]);
      if (id != null) almacenIds.add(id);
    }
    if (iProdName >= 0) {
      const n = toStr(row[iProdName]);
      if (n) productNames.add(n);
    }
    if (iAlmName >= 0) {
      const n = toStr(row[iAlmName]);
      if (n) almacenNames.add(n);
    }
  }

  const filter: SqlRawRowFilter = {};
  if (productIds.size) filter.productIds = [...productIds];
  if (almacenIds.size) filter.almacenIds = [...almacenIds];
  if (productNames.size) {
    filter.productNames = [...productNames];
    filter.productNameKeys = new Set([...productNames].map(normSqlLabel));
  }
  if (almacenNames.size) {
    filter.almacenNames = [...almacenNames];
    filter.almacenNameKeys = new Set([...almacenNames].map(normSqlLabel));
  }

  if (
    !filter.productIds?.length &&
    !filter.almacenIds?.length &&
    !filter.productNames?.length &&
    !filter.almacenNames?.length
  ) {
    return null;
  }
  return filter;
}

export function rawRowMatchesSqlFilter(
  row: { idprod: number; idalmacen: number; producto: string; almacen: string },
  filter: SqlRawRowFilter,
): boolean {
  if (filter.productIds?.length && !filter.productIds.includes(row.idprod)) {
    return false;
  }
  if (filter.almacenIds?.length && !filter.almacenIds.includes(row.idalmacen)) {
    return false;
  }
  if (filter.productNameKeys?.size) {
    if (!filter.productNameKeys.has(normSqlLabel(row.producto))) return false;
  }
  if (filter.almacenNameKeys?.size) {
    if (!filter.almacenNameKeys.has(normSqlLabel(row.almacen))) return false;
  }
  return true;
}
