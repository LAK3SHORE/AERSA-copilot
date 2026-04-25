"""Pydantic request/response models for the FastAPI surface (CLAUDE.md §9).

Field shapes mirror the engine dataclasses (`KPISummary`, `AnomalyRecord`,
`CierreReport` in `engine/report.py`). Keep them in sync if the engine adds
fields — Pydantic v2 is strict on unknown keys when a model is the
response_model.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CompanyOut(BaseModel):
    idempresa: int
    nombre: str
    num_inventarios: int


class KPISummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class AnomalyRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idinventariomesdetalle: int
    idproducto: int
    producto_nombre: str
    idcategoria: int | None = None
    categoria_nombre: str
    subcategoria_nombre: str
    idalmacen: int
    almacen_nombre: str
    idsucursal: int
    periodo: str
    merma_rate: float | None = None
    z_score: float | None = None
    financial_impact_mxn: float
    priority_score: float
    severity_label: Literal["CRÍTICO", "ALTO", "MEDIO", "BAJO"]
    mean_merma_rate_hist: float | None = None
    recurrence_count: int
    unidad_medida: str


class CierreReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idempresa: int
    periodo: str
    generated_at: str
    kpis: KPISummaryOut
    top_anomalies: list[AnomalyRecordOut]
    total_anomalies_found: int
    data_quality_warnings: list[str] = Field(default_factory=list)


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    idempresa: int
    periodo: str = Field(pattern=r"^\d{4}-\d{2}$")
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatHistoryMessage] = Field(default_factory=list)


class HealthOut(BaseModel):
    ok: bool
    database: dict[str, Any] | None = None
    error: str | None = None


__all__ = [
    "CompanyOut",
    "KPISummaryOut",
    "AnomalyRecordOut",
    "CierreReportOut",
    "ChatHistoryMessage",
    "ChatRequest",
    "HealthOut",
]
