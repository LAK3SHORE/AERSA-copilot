"""Anomaly detection: per-(producto, almacen) baseline + per-line z-scores.

Pipeline (CLAUDE.md §6.2):
  1. Pull historical observations per (producto, almacen, periodo) from the
     last `lookback_months` periods (excluding the current one).
  2. Aggregate per (producto, almacen): mean, std, q25, q75, IQR, n_periods.
  3. For each current-period line, compute merma_rate and join the baseline.
  4. Compute z-score, IQR outlier flag, and recurrence count.

Outputs a DataFrame keyed by `idinventariomesdetalle` with all the metrics
the scoring module needs.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import settings
from db.queries.anomalies import fetch_historical_baseline


def _aggregate_baseline(obs: pd.DataFrame) -> pd.DataFrame:
    """Reduce per-(producto, almacen, periodo) observations to per-(producto,
    almacen) statistics."""
    if obs.empty:
        return pd.DataFrame(
            columns=[
                "idproducto", "idalmacen",
                "mean_merma_rate_hist", "std_merma_rate_hist",
                "q25", "q75", "iqr", "n_periods",
            ]
        )

    obs = obs.copy()
    obs["merma_rate"] = (
        obs["loss_units"].astype(float) / obs["teorico_units"].astype(float)
    )

    grp = obs.groupby(["idproducto", "idalmacen"])["merma_rate"]
    stats = grp.agg(
        mean_merma_rate_hist="mean",
        std_merma_rate_hist=lambda s: float(s.std(ddof=0)) if len(s) > 1 else 0.0,
        q25=lambda s: float(s.quantile(0.25)),
        q75=lambda s: float(s.quantile(0.75)),
        n_periods="count",
    ).reset_index()
    stats["iqr"] = stats["q75"] - stats["q25"]
    return stats


def _recurrence_count(
    obs: pd.DataFrame,
    baseline: pd.DataFrame,
    last_n: int = 4,
) -> pd.DataFrame:
    """Per (producto, almacen), count how many of the last `last_n` periods
    had merma_rate > mean + 2*std (a proxy for z > 2 from §6.3).

    Uses the full-window mean/std as the threshold; that's an approximation
    of the leave-one-out z-score but acceptable for v0.
    """
    if obs.empty or baseline.empty:
        return pd.DataFrame(columns=["idproducto", "idalmacen", "recurrence_count"])

    obs = obs.copy()
    obs["merma_rate"] = (
        obs["loss_units"].astype(float) / obs["teorico_units"].astype(float)
    )

    # Last `last_n` periods per (producto, almacen) by lexicographic periodo.
    obs = obs.sort_values(["idproducto", "idalmacen", "periodo"])
    obs["rk"] = obs.groupby(["idproducto", "idalmacen"]).cumcount(ascending=False)
    recent = obs[obs["rk"] < last_n]

    joined = recent.merge(
        baseline[["idproducto", "idalmacen", "mean_merma_rate_hist", "std_merma_rate_hist"]],
        on=["idproducto", "idalmacen"],
        how="inner",
    )
    threshold = (
        joined["mean_merma_rate_hist"] + 2.0 * joined["std_merma_rate_hist"]
    )
    joined["over"] = joined["merma_rate"] > threshold

    return (
        joined.groupby(["idproducto", "idalmacen"])["over"]
        .sum()
        .astype(int)
        .reset_index(name="recurrence_count")
    )


def compute_baseline(
    idempresa: int,
    current_periodo: str,
    lookback_months: int | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fetch and aggregate the historical baseline.

    Returns (baseline_stats, raw_observations). Raw observations are kept
    so the recurrence calculation can use them later without a second DB
    round-trip.
    """
    lookback = lookback_months or settings.anomaly_rolling_window_months
    obs = fetch_historical_baseline(idempresa, current_periodo, lookback)
    stats = _aggregate_baseline(obs)
    return stats, obs


def annotate_lines(
    lines: pd.DataFrame,
    baseline_stats: pd.DataFrame,
    baseline_obs: pd.DataFrame,
) -> pd.DataFrame:
    """Attach merma_rate, z-score, IQR-outlier, recurrence to each line.

    Lines without baseline (`n_periods` < min) get NaN z-score and a
    `has_baseline = False` flag — scoring handles those separately.
    """
    if lines.empty:
        return lines.assign(
            merma_rate=pd.Series(dtype="float64"),
            z_score=pd.Series(dtype="float64"),
            iqr_outlier=pd.Series(dtype="bool"),
            recurrence_count=0,
            has_baseline=False,
            financial_impact_mxn=pd.Series(dtype="float64"),
        )

    df = lines.copy()
    teorico = df["stock_teorico"].astype(float)
    diferencia = df["diferencia"].astype(float)
    df["merma_rate"] = np.where(teorico > 0, -diferencia / teorico, np.nan)
    df["financial_impact_mxn"] = (
        diferencia.abs() * df["costo_promedio"].astype(float).fillna(0.0)
    )

    df = df.merge(baseline_stats, on=["idproducto", "idalmacen"], how="left")

    rec = _recurrence_count(baseline_obs, baseline_stats)
    df = df.merge(rec, on=["idproducto", "idalmacen"], how="left")
    df["recurrence_count"] = df["recurrence_count"].fillna(0).astype(int)

    df["has_baseline"] = df["n_periods"].fillna(0).astype(int) >= settings.anomaly_min_history_periods

    # z-score (NaN where std is 0 or baseline missing)
    std = df["std_merma_rate_hist"]
    mean = df["mean_merma_rate_hist"]
    safe_std = std.where(std.fillna(0) > 0)
    df["z_score"] = (df["merma_rate"] - mean) / safe_std

    # IQR fallback for cases where std collapses to 0
    iqr_bound = df["q75"] + 1.5 * df["iqr"]
    df["iqr_outlier"] = (df["merma_rate"] > iqr_bound).fillna(False)

    return df
