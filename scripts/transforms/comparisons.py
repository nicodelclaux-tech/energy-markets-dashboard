"""
scripts/transforms/comparisons.py
----------------------------------
Pre-computes dashboard-friendly comparison metrics from a pandas Series
indexed by date.

Functions
---------
compute_changes        — absolute and % change over 1d / 1w / 1m / 1y
compute_range          — 5Y high / low / percentile rank
rebase_100             — normalise series so first value = 100
rolling_correlation    — 30-day rolling correlation between two series
compute_spread         — arithmetic spread (s1 − s2)
compute_all_comparisons — convenience wrapper for multiple named series
"""

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _get_offset_value(series: pd.Series, n_obs: int) -> Optional[float]:
    """Return the value *n_obs* positions before the last observation."""
    if len(series) > n_obs:
        return float(series.iloc[-(n_obs + 1)])
    return None


def compute_changes(series: pd.Series) -> dict:
    """
    Compute absolute and percentage changes for common look-back horizons.

    Parameters
    ----------
    series : pd.Series
        Numeric series with a DatetimeIndex or date-string index, sorted
        ascending.

    Returns
    -------
    dict with keys:
        latest_value, latest_date,
        change_1d, pct_change_1d,
        change_1w, pct_change_1w,
        change_1m, pct_change_1m,
        change_1y, pct_change_1y
    """
    result: dict = {}
    series = series.dropna()
    if series.empty:
        return result

    latest = float(series.iloc[-1])
    result["latest_value"] = round(latest, 4)
    try:
        result["latest_date"] = series.index[-1].strftime("%Y-%m-%d")
    except AttributeError:
        result["latest_date"] = str(series.index[-1])

    # Approximate trading-day offsets: 5 ≈ 1 week, 21 ≈ 1 month, 252 ≈ 1 year
    horizons = {"1d": 1, "1w": 5, "1m": 21, "1y": 252}
    for label, n in horizons.items():
        prior = _get_offset_value(series, n)
        if prior is not None and prior != 0:
            change = round(latest - prior, 4)
            pct = round((latest - prior) / abs(prior) * 100, 2)
        else:
            change = None
            pct = None
        result[f"change_{label}"] = change
        result[f"pct_change_{label}"] = pct

    return result


def compute_range(series: pd.Series) -> dict:
    """
    Compute 5Y high, 5Y low, and current percentile within the series.

    Returns
    -------
    dict with keys: high_5y, low_5y, current_pct_rank
    """
    series = series.dropna()
    if series.empty:
        return {}
    high = round(float(series.max()), 4)
    low = round(float(series.min()), 4)
    latest = float(series.iloc[-1])
    rng = high - low
    pct_rank = round((latest - low) / rng * 100, 1) if rng > 0 else 50.0
    return {"high_5y": high, "low_5y": low, "current_pct_rank": pct_rank}


def rebase_100(series: pd.Series) -> pd.Series:
    """
    Normalise *series* so its first non-NaN value equals 100.

    Returns a new Series with the same index.
    """
    s = series.dropna()
    if s.empty:
        return series
    base = s.iloc[0]
    if base == 0:
        return series
    rebased = (series / base * 100).round(4)
    return rebased


def rolling_correlation(
    s1: pd.Series,
    s2: pd.Series,
    window: int = 30,
) -> pd.Series:
    """
    Compute rolling *window*-observation Pearson correlation between s1 and s2.

    Both series are aligned on their common index before computing.
    """
    aligned = pd.concat([s1.rename("a"), s2.rename("b")], axis=1).dropna()
    if len(aligned) < window:
        logger.warning(
            "rolling_correlation: fewer observations (%d) than window (%d)",
            len(aligned),
            window,
        )
        return pd.Series(dtype=float)
    corr = aligned["a"].rolling(window).corr(aligned["b"]).round(4)
    return corr


def compute_spread(s1: pd.Series, s2: pd.Series) -> pd.Series:
    """Return the arithmetic spread s1 − s2 aligned on a common date index."""
    aligned = pd.concat([s1.rename("a"), s2.rename("b")], axis=1)
    return (aligned["a"] - aligned["b"]).round(4)


def _series_to_records(series: pd.Series, unit: str = "") -> list[dict]:
    """Convert a pandas Series to a list of {date, value} dicts."""
    records = []
    for idx, val in series.items():
        if pd.isna(val):
            continue
        records.append({"date": str(idx)[:10], "value": round(float(val), 4), "unit": unit})
    return records


def compute_all_comparisons(
    all_series: dict[str, pd.Series],
    units: Optional[dict[str, str]] = None,
) -> dict:
    """
    Compute changes, range, and rebase-100 index for every named series in
    *all_series*.

    Parameters
    ----------
    all_series : dict mapping series name → pd.Series (DatetimeIndex, values)
    units      : dict mapping series name → unit string (optional)

    Returns
    -------
    dict suitable for direct inclusion in APP_DATA["comparisons"]
    """
    units = units or {}
    result: dict = {}
    for name, series in all_series.items():
        series = series.dropna()
        if series.empty:
            logger.warning("compute_all_comparisons: empty series '%s'", name)
            result[name] = {}
            continue
        entry: dict = {}
        entry.update(compute_changes(series))
        entry.update(compute_range(series))
        entry["rebase_100"] = _series_to_records(rebase_100(series), units.get(name, ""))
        result[name] = entry

    # Add cross-series correlation examples
    keys = list(all_series.keys())
    corr_pairs = [
        ("brent", "wti"),
        ("brent", "eurusd"),
        ("henry_hub", "eurusd"),
    ]
    correlations: dict = {}
    for a, b in corr_pairs:
        if a in all_series and b in all_series:
            corr = rolling_correlation(all_series[a].dropna(), all_series[b].dropna())
            if not corr.empty:
                correlations[f"{a}_vs_{b}"] = _series_to_records(corr)
    if correlations:
        result["_correlations"] = correlations

    return result
