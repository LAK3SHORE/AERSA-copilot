"""Composite priority scoring (CLAUDE.md 6.3).

Each annotated line gets a 0–100 priority score combining:
  - severity (z-score, capped at 1.0 at z=5)
  - impact   (financial_impact_mxn / max impact in this Cierre)
  - recurrence (count of recent periods over threshold, capped at 4)
  - category weight (Alimentos 1.0, Bebidas 1.2, Gastos 0.8)

`score_ponderado` (Session 15) is a separate min-max composite used to rank
hallazgos in the UI — see `compute_score_ponderado`.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Session 15 — weighted ranking score (configurable)
W_Z = 0.40
W_SCORE = 0.25
W_REC = 0.15
W_MXN = 0.12
W_MERMA = 0.08

# Top-level idcategoria → multiplier (CLAUDE.md 6.3).
# 1=Alimentos, 2=Bebidas, 3=Gastos. Anything else falls back to 1.0.
CATEGORY_WEIGHTS: dict[int, float] = {1: 1.0, 2: 1.2, 3: 0.8}

# Score thresholds → severity label.
SEVERITY_BANDS: list[tuple[float, str]] = [
    (75.0, "CRÍTICO"),
    (50.0, "ALTO"),
    (25.0, "MEDIO"),
    (0.0, "BAJO"),
]


def _label_for(score: float) -> str:
    for threshold, label in SEVERITY_BANDS:
        if score >= threshold:
            return label
    return "BAJO"


def compute_priority_scores(df: pd.DataFrame) -> pd.DataFrame:
    """Add `priority_score` (0–100) and `severity_label` to an annotated lines df.

    Expects the columns produced by `engine.anomaly.annotate_lines`:
      z_score, financial_impact_mxn, recurrence_count, idcategoria, has_baseline.
    """
    if df.empty:
        return df.assign(priority_score=pd.Series(dtype="float64"), severity_label="BAJO")

    out = df.copy()

    # Severity from z-score, capped at 1.0 (z=5). Lines without a baseline
    # but with negative diferencia get a flat 0.3 — they're "unknown but
    # potentially noteworthy" and shouldn't dominate the ranking.
    z = out["z_score"].astype(float)
    severity = (z / 5.0).clip(lower=0.0, upper=1.0).fillna(0.0)
    no_baseline_mask = ~out["has_baseline"].astype(bool) & (out["merma_rate"].fillna(0) > 0)
    severity = severity.where(out["has_baseline"], 0.3 * no_baseline_mask.astype(float))

    # Impact normalized by the max impact in this Cierre (so the worst line
    # always scores 1.0 and the rest are relative).
    impact_raw = out["financial_impact_mxn"].astype(float).fillna(0.0)
    max_impact = float(impact_raw.max() or 1.0)
    impact = (impact_raw / max_impact).clip(lower=0.0, upper=1.0)

    # Recurrence (last 4 periods over threshold, normalized to [0,1]).
    recurrence = (out["recurrence_count"].astype(float) / 4.0).clip(0.0, 1.0)

    # Category weight via top-level idcategoria.
    weights = (
        out["idcategoria"]
        .map(CATEGORY_WEIGHTS)
        .fillna(1.0)
        .astype(float)
    )

    raw = (0.40 * severity + 0.40 * impact + 0.20 * recurrence) * weights
    score = (raw * 100.0).clip(lower=0.0, upper=100.0).round(1)

    out["priority_score"] = score
    out["severity_label"] = score.apply(_label_for)

    # Mark IQR-only outliers (no/low std) as at least MEDIO so they don't
    # disappear from the top list when impact is also small.
    iqr_bump = out["iqr_outlier"].fillna(False) & (out["severity_label"] == "BAJO")
    out.loc[iqr_bump, "severity_label"] = "MEDIO"

    return out


def _min_max_norm(series: pd.Series) -> pd.Series:
    """Normalize to [0, 1] across the Cierre; flat series → zeros."""
    s = series.astype(float).fillna(0.0)
    lo, hi = float(s.min()), float(s.max())
    if hi <= lo:
        return pd.Series(0.0, index=s.index)
    return (s - lo) / (hi - lo)


def compute_score_ponderado(df: pd.DataFrame) -> pd.DataFrame:
    """Add `score_ponderado` (0–100) for hallazgo ranking (Session 15).

    Min-max normalization is per-cierre across all rows in `df`.
    Expects columns from `compute_priority_scores`: z_score, priority_score,
    recurrence_count, financial_impact_mxn, merma_rate.
    """
    if df.empty:
        return df.assign(score_ponderado=pd.Series(dtype="float64"))

    out = df.copy()
    z_norm = _min_max_norm(out["z_score"].fillna(0.0))
    score_norm = _min_max_norm(out["priority_score"].fillna(0.0))
    rec_norm = _min_max_norm(out["recurrence_count"].astype(float) / 4.0)
    mxn_norm = _min_max_norm(out["financial_impact_mxn"].fillna(0.0))
    merma_pct = out["merma_rate"].fillna(0.0).astype(float) * 100.0
    merma_norm = _min_max_norm(merma_pct)

    raw = (
        W_Z * z_norm
        + W_SCORE * score_norm
        + W_REC * rec_norm
        + W_MXN * mxn_norm
        + W_MERMA * merma_norm
    )
    out["score_ponderado"] = (raw * 100.0).clip(lower=0.0, upper=100.0).round(1)
    return out


__all__ = [
    "compute_priority_scores",
    "compute_score_ponderado",
    "CATEGORY_WEIGHTS",
    "SEVERITY_BANDS",
    "W_Z",
    "W_SCORE",
    "W_REC",
    "W_MXN",
    "W_MERMA",
]
