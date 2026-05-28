export type TablaName = "cierre_detalle" | "requisiciones" | "inventario_fisico" | "ventas";

export interface RawRow {
  idalmacen: number;
  almacen: string;
  idprod: number;
  producto: string;
  cat: string;
  sf: number;
  st: number;
  d: number;
  mp: number;
  mxn: number;
  z: number;
}

export interface RawCierreResponse {
  tabla: string;
  idempresa: number;
  periodo: string;
  total_rows: number;
  rows: RawRow[];
}
