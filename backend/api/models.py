"""Pydantic request/response models for the FastAPI surface (CLAUDE.md 9).

Field shapes mirror the engine dataclasses (`KPISummary`, `AnomalyRecord`,
`CierreReport` in `engine/report.py`). Keep them in sync if the engine adds
fields — Pydantic v2 is strict on unknown keys when a model is the
response_model.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from auth.models import User


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
    score_ponderado: float
    severity_label: Literal["CRÍTICO", "ALTO", "MEDIO", "BAJO"]
    stock_fisico: float
    stock_teorico: float
    delta: float
    mean_merma_rate_hist: float | None = None
    recurrence_count: int
    unidad_medida: str


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class FindingContextIn(BaseModel):
    """When the auditor clicks a hallazgo, the UI sends IDs — agent must not ask for more."""

    idinventariomesdetalle: int
    idproducto: int
    idalmacen: int
    producto_nombre: str
    almacen_nombre: str
    severity_label: str | None = None


class ChatRequest(BaseModel):
    idempresa: int
    periodo: str = Field(pattern=r"^\d{4}-\d{2}$")
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    session_id: int | None = None
    suggested: bool = False
    finding_context: FindingContextIn | None = None


class CorporativoChatRequest(BaseModel):
    """Owner analytics copilot — no Cierre context required."""

    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    days: int = Field(default=30, ge=1, le=365)


class AuditBriefActionOut(BaseModel):
    rank: int
    idinventariomesdetalle: int
    producto_nombre: str
    almacen_nombre: str
    severity_label: str
    title: str
    reason: str
    suggested_prompt: str


class AuditBriefOut(BaseModel):
    idempresa: int
    periodo: str
    headline: str
    summary: str
    action_count: int
    actions: list[dict[str, Any]]


class CategoryBreakdownRowOut(BaseModel):
    categoria: str
    total_merma_mxn: float
    pct_del_total: float
    num_productos: int


class AlmacenBreakdownRowOut(BaseModel):
    idalmacen: int
    almacen: str
    total_merma_mxn: float
    pct_del_total: float
    num_productos: int
    num_lineas: int


class ReportBundleOut(BaseModel):
    idempresa: int
    periodo: str
    generated_at: str
    brief: dict[str, Any]
    category_breakdown: list[CategoryBreakdownRowOut]
    almacen_breakdown: list[AlmacenBreakdownRowOut]
    severity_counts: dict[str, int]


class CierreReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idempresa: int
    periodo: str
    generated_at: str
    kpis: KPISummaryOut
    top_anomalies: list[AnomalyRecordOut]
    total_anomalies_found: int
    data_quality_warnings: list[str] = Field(default_factory=list)
    audit_session_id: int | None = None
    finding_statuses: dict[int, str] = Field(default_factory=dict)


class RawRowOut(BaseModel):
    idalmacen: int
    almacen: str
    idprod: int
    producto: str
    cat: str
    sf: float
    st: float
    d: float
    mp: float
    mxn: float
    z: float


class RawCierreOut(BaseModel):
    tabla: str
    idempresa: int
    periodo: str
    total_rows: int
    rows: list[RawRowOut]


class Nl2SqlRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    idempresa: int = Field(ge=1)
    periodo: str = Field(pattern=r"^\d{4}-\d{2}$")
    tabla: str = "cierre_detalle"


class HealthOut(BaseModel):
    ok: bool
    database: dict[str, Any] | None = None
    error: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    role: Literal["auditor", "corporativo"]
    idempresa: int | None = None

    @classmethod
    def from_user(cls, user: User) -> UserOut:
        return cls(
            id=user.id,
            username=user.username,
            role=user.role.value,
            idempresa=user.idempresa,
        )


__all__ = [
    "AuditBriefOut",
    "CompanyOut",
    "KPISummaryOut",
    "AnomalyRecordOut",
    "ReportBundleOut",
    "CategoryBreakdownRowOut",
    "AlmacenBreakdownRowOut",
    "CierreReportOut",
    "ChatHistoryMessage",
    "ChatRequest",
    "CorporativoChatRequest",
    "HealthOut",
    "TokenOut",
    "UserOut",
]
