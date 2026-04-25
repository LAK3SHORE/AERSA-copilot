"""Composite priority scoring (CLAUDE.md §6.3).

Each annotated line gets a 0–100 priority score combining:
  - severity (z-score, capped at 1.0 at z=5)
  - impact   (financial_impact_mxn / max impact in this Cierre)
  - recurrence (count of recent periods over threshold, capped at 4)
  - category weight (Alimentos 1.0, Bebidas 1.2, Gastos 0.8)

The score then maps to a CRÍTICO / ALTO / MEDIO / BAJO label.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Top-level idcategoria → multiplier (CLAUDE.md §6.3).
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


__all__ = ["compute_priority_scores", "CATEGORY_WEIGHTS", "SEVERITY_BANDS"]
