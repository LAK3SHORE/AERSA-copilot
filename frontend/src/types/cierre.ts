export type SeverityLabel = "CRÍTICO" | "ALTO" | "MEDIO" | "BAJO";
export type FindingStatus = "pendiente" | "revisado" | "escalado";

export interface KPISummary {
  idempresa: number;
  periodo: string;
  num_almacenes: number;
  num_productos: number;
  num_lineas: number;
  total_importe_fisico_mxn: number;
  total_faltantes_mxn: number;
  total_sobrantes_mxn: number;
  total_compras_unidades: number;
  total_ventas_unidades: number;
  top_categoria_faltante: string;
  pct_lineas_con_merma: number;
}

export interface Hallazgo {
  idinventariomesdetalle: number;
  idproducto: number;
  producto_nombre: string;
  idcategoria: number | null;
  categoria_nombre: string;
  subcategoria_nombre: string;
  idalmacen: number;
  almacen_nombre: string;
  idsucursal: number;
  periodo: string;
  merma_rate: number | null;
  z_score: number | null;
  financial_impact_mxn: number;
  priority_score: number;
  score_ponderado: number;
  severity_label: SeverityLabel;
  stock_fisico: number;
  stock_teorico: number;
  delta: number;
  mean_merma_rate_hist: number | null;
  recurrence_count: number;
  unidad_medida: string;
}

export interface CierreReport {
  idempresa: number;
  periodo: string;
  generated_at: string;
  kpis: KPISummary;
  top_anomalies: Hallazgo[];
  total_anomalies_found: number;
  data_quality_warnings: string[];
  audit_session_id?: number | null;
  finding_statuses?: Record<number, string>;
}

export interface AccionItem {
  rank: number;
  idinventariomesdetalle: number;
  idproducto: number;
  idalmacen: number;
  producto_nombre: string;
  almacen_nombre: string;
  severity_label: SeverityLabel;
  title: string;
  reason: string;
  suggested_prompt: string;
}

export interface AuditBrief {
  idempresa: number;
  periodo: string;
  headline: string;
  summary: string;
  action_count: number;
  actions: AccionItem[];
}

export interface Herramienta {
  nombre: string;
  desc: string;
  ejemplo: string;
  prompt: string;
}
