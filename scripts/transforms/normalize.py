"""
scripts/transforms/normalize.py
--------------------------------
Date and value normalization utilities shared by all adapters and the build
script.

Key functions
-------------
normalize_dates     — coerce date column to ISO YYYY-MM-DD string
normalize_values    — coerce value column to float, drop NaN
dedup_series        — remove duplicate (date, key) rows
add_metadata        — attach source / unit / series_id columns
align_to_daily      — forward-fill a sparse series to daily frequency
export_csv          — save a DataFrame to data/processed/
"""

import logging
from pathlib import Path
from typing import Union

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Unit display metadata
# ---------------------------------------------------------------------------
UNIT_METADATA: dict[str, dict] = {
    "EUR/MWh":   {"label": "EUR/MWh",   "type": "price",    "currency": "EUR"},
    "USD/bbl":   {"label": "USD/bbl",   "type": "price",    "currency": "USD"},
    "USD/MMBtu": {"label": "USD/MMBtu", "type": "price",    "currency": "USD"},
    "EUR/t":     {"label": "EUR/t",     "type": "price",    "currency": "EUR"},
    "FX":        {"label": "FX rate",   "type": "fx",       "currency": None},
    "TWh":       {"label": "TWh",       "type": "volume",   "currency": None},
    "Bcf":       {"label": "Bcf",       "type": "volume",   "currency": None},
    "%":         {"label": "%",         "type": "share",    "currency": None},
    "unknown":   {"label": "n/a",       "type": "unknown",  "currency": None},
}


def normalize_dates(df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
    """
    Coerce *date_col* to ISO ``YYYY-MM-DD`` strings, sort ascending, and
    drop rows where the date cannot be parsed.
    """
    if date_col not in df.columns:
        logger.warning("normalize_dates: column '%s' not in DataFrame", date_col)
        return df
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce").dt.strftime("%Y-%m-%d")
    df.dropna(subset=[date_col], inplace=True)
    df.sort_values(date_col, inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def normalize_values(
    df: pd.DataFrame,
    value_col: str = "value",
    round_digits: int = 4,
) -> pd.DataFrame:
    """
    Coerce *value_col* to float, round to *round_digits* decimals, and
    drop rows where the value is NaN or infinite.
    """
    if value_col not in df.columns:
        logger.warning("normalize_values: column '%s' not in DataFrame", value_col)
        return df
    df = df.copy()
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df[df[value_col].notna() & df[value_col].apply(lambda x: x == x and abs(x) < 1e15)]
    df[value_col] = df[value_col].round(round_digits)
    df.reset_index(drop=True, inplace=True)
    return df


def dedup_series(
    df: pd.DataFrame,
    key_cols: Union[list[str], None] = None,
) -> pd.DataFrame:
    """
    Remove duplicate rows, keeping the last occurrence per *key_cols*.
    Defaults to ['date'] if *key_cols* is None.
    """
    cols = key_cols or ["date"]
    available = [c for c in cols if c in df.columns]
    if not available:
        return df
    df = df.copy()
    df.drop_duplicates(subset=available, keep="last", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def add_metadata(
    df: pd.DataFrame,
    source: str,
    unit: str,
    series_id: str,
) -> pd.DataFrame:
    """Attach source / unit / series_id columns if they are not already present."""
    df = df.copy()
    if "source" not in df.columns:
        df["source"] = source
    if "unit" not in df.columns:
        df["unit"] = unit
    if "series_id" not in df.columns:
        df["series_id"] = series_id
    return df


def align_to_daily(
    df: pd.DataFrame,
    date_col: str = "date",
    value_col: str = "value",
    method: str = "ffill",
) -> pd.DataFrame:
    """
    Re-index a time series to a continuous daily calendar and fill gaps using
    *method* (``'ffill'`` by default).  The DataFrame must already have dates
    as ISO strings in *date_col*.
    """
    if df.empty or date_col not in df.columns or value_col not in df.columns:
        return df

    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.set_index(date_col).sort_index()

    if not isinstance(df.index, pd.DatetimeIndex):
        return df

    full_range = pd.date_range(df.index.min(), df.index.max(), freq="D")
    df = df.reindex(full_range)
    df.index.name = date_col

    if method == "ffill":
        df[value_col] = df[value_col].ffill()
    elif method == "bfill":
        df[value_col] = df[value_col].bfill()
    elif method == "interpolate":
        df[value_col] = df[value_col].interpolate(method="time")

    # Propagate non-value scalar columns
    for col in df.columns:
        if col != value_col:
            df[col] = df[col].ffill().bfill()

    df.reset_index(inplace=True)
    df[date_col] = df[date_col].dt.strftime("%Y-%m-%d")
    return df


def export_csv(df: pd.DataFrame, path: Path) -> None:
    """Save *df* to *path* creating parent directories as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    logger.info("Exported %d rows → %s", len(df), path)
