export interface CategoryBreakdownRow {
  categoria: string;
  total_merma_mxn: number;
  pct_del_total: number;
  num_productos: number;
}

export interface AlmacenBreakdownRow {
  idalmacen: number;
  almacen: string;
  total_merma_mxn: number;
  pct_del_total: number;
  num_productos: number;
  num_lineas: number;
}

export interface ReportBundle {
  idempresa: number;
  periodo: string;
  generated_at: string;
  brief: {
    headline: string;
    summary: string;
    action_count: number;
    actions: {
      rank: number;
      producto_nombre: string;
      almacen_nombre: string;
      severity_label: string;
      title: string;
      reason: string;
    }[];
  };
  category_breakdown: CategoryBreakdownRow[];
  almacen_breakdown: AlmacenBreakdownRow[];
  severity_counts: Record<string, number>;
}
