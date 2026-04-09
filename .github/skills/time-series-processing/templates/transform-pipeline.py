"""
Transform Pipeline Template — Power Dashboard
---------------------------------------------
Copy this file as a starting point for new transform modules.
Each section can be imported independently.
"""

from __future__ import annotations
import math
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Date & Deduplication
# ─────────────────────────────────────────────────────────────────────────────

def normalize_dates(records: list[dict], date_field: str = "date") -> list[dict]:
    """
    Normalize dates to 'YYYY-MM-DD', deduplicate (keep last), sort ascending.
    Missing date field raises KeyError intentionally — it's a schema error.
    """
    seen: dict[str, dict] = {}
    for r in records:
        date = str(r[date_field])[:10]
        seen[date] = {**r, date_field: date}
    return sorted(seen.values(), key=lambda x: x[date_field])


def align_series(
    series_a: list[dict],
    series_b: list[dict],
    date_field: str = "date",
) -> tuple[list[dict], list[dict]]:
    """
    Return two sub-lists containing only dates present in BOTH inputs.
    Order: ascending by date.
    """
    dates_a = {r[date_field] for r in series_a}
    dates_b = {r[date_field] for r in series_b}
    common = dates_a & dates_b
    out_a = sorted([r for r in series_a if r[date_field] in common], key=lambda x: x[date_field])
    out_b = sorted([r for r in series_b if r[date_field] in common], key=lambda x: x[date_field])
    return out_a, out_b


# ─────────────────────────────────────────────────────────────────────────────
# Returns & Volatility
# ─────────────────────────────────────────────────────────────────────────────

def add_log_returns(records: list[dict], price_field: str = "close") -> list[dict]:
    """Append 'log_return' field. First record gets None."""
    result = [{**records[0], "log_return": None}] if records else []
    for i in range(1, len(records)):
        prev = records[i - 1][price_field]
        curr = records[i][price_field]
        if prev and prev > 0 and curr and curr > 0:
            lr = round(math.log(curr / prev), 6)
        else:
            lr = None
        result.append({**records[i], "log_return": lr})
    return result


def rolling_volatility(
    records: list[dict],
    window: int = 30,
    price_field: str = "close",
    output_field: str = "vol30d",
) -> list[dict]:
    """
    Annualized volatility of log returns over a rolling window.
    Appends `output_field` (% value) to each record. None during warm-up.
    Formula: std(log_returns) * sqrt(252) * 100
    """
    with_lr = add_log_returns(records, price_field)
    result = []
    for i, r in enumerate(with_lr):
        vol: Optional[float] = None
        if i >= window:
            window_values = [
                x["log_return"] for x in with_lr[i - window + 1 : i + 1]
                if x["log_return"] is not None
            ]
            if len(window_values) >= window // 2:
                mean = sum(window_values) / len(window_values)
                variance = sum((x - mean) ** 2 for x in window_values) / len(window_values)
                vol = round(math.sqrt(variance * 252) * 100, 2)
        result.append({**r, output_field: vol})
    return result


def pearson_correlation(xs: list[float], ys: list[float]) -> Optional[float]:
    """Pearson r for two equal-length lists. Returns None if undefined."""
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den_x = math.sqrt(sum((x - mx) ** 2 for x in xs))
    den_y = math.sqrt(sum((y - my) ** 2 for y in ys))
    if den_x == 0 or den_y == 0:
        return None
    return round(num / (den_x * den_y), 4)


def rolling_correlation(
    series_a: list[dict],
    series_b: list[dict],
    window: int = 90,
    price_field: str = "close",
) -> list[dict]:
    """
    Rolling Pearson correlation between two aligned series.
    Both series must be aligned (same dates, same length).
    Returns list of {date, correlation} dicts. None during warm-up.
    """
    assert len(series_a) == len(series_b), "Series must be aligned before rolling_correlation"
    result = []
    for i in range(len(series_a)):
        corr = None
        if i >= window:
            xs = [series_a[j][price_field] for j in range(i - window + 1, i + 1)
                  if series_a[j][price_field] is not None]
            ys = [series_b[j][price_field] for j in range(i - window + 1, i + 1)
                  if series_b[j][price_field] is not None]
            if len(xs) >= window // 2:
                corr = pearson_correlation(xs, ys)
        result.append({"date": series_a[i]["date"], "correlation": corr})
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Year-over-Year
# ─────────────────────────────────────────────────────────────────────────────

def add_yoy_change(records: list[dict], price_field: str = "close") -> list[dict]:
    """
    Append 'yoy_change_pct'. Looks up same calendar day in prior year.
    Missing prior year → None.
    """
    by_date = {r["date"]: r[price_field] for r in records}

    def prior_year(date_str: str) -> str:
        y, m, d = date_str.split("-")
        return f"{int(y) - 1}-{m}-{d}"

    result = []
    for r in records:
        prev = by_date.get(prior_year(r["date"]))
        curr = r[price_field]
        if prev is not None and prev != 0:
            yoy: Optional[float] = round((curr - prev) / abs(prev) * 100, 2)
        else:
            yoy = None
        result.append({**r, "yoy_change_pct": yoy})
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Spreads
# ─────────────────────────────────────────────────────────────────────────────

def compute_spread(
    records_a: list[dict],
    records_b: list[dict],
    key_a: str,
    key_b: str,
    price_field: str = "close",
) -> list[dict]:
    """
    Returns [{date, f'{key_a}_{key_b}_spread'}] for overlapping dates.
    Spread = price_a - price_b.
    """
    b_by_date = {r["date"]: r[price_field] for r in records_b}
    result = []
    for r in records_a:
        pb = b_by_date.get(r["date"])
        if pb is not None and r[price_field] is not None:
            result.append({
                "date": r["date"],
                f"{key_a}_{key_b}_spread": round(r[price_field] - pb, 2),
            })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Unit Conversion
# ─────────────────────────────────────────────────────────────────────────────

def usd_bbl_to_eur_mwh(
    records: list[dict],
    fx_records: list[dict],
    price_field: str = "close",
    energy_content_mwh_per_bbl: float = 1.7,
) -> list[dict]:
    """
    Convert USD/barrel → EUR/MWh using daily ECB EUR/USD rate.
    Records without a matching FX date get price = None (show gap, not 0).
    """
    fx_by_date = {r["date"]: r["close"] for r in fx_records}
    result = []
    for r in records:
        fx = fx_by_date.get(r["date"])
        price_usd = r.get(price_field)
        if fx and fx > 0 and price_usd is not None:
            eur_mwh: Optional[float] = round(price_usd / fx / energy_content_mwh_per_bbl, 2)
        else:
            eur_mwh = None
        result.append({**r, price_field: eur_mwh, "currency": "EUR", "unit": "EUR/MWh"})
    return result


def rebase_to_100(
    records: list[dict],
    base_date: str,
    price_field: str = "close",
    output_field: str = "rebased",
) -> list[dict]:
    """
    Rebase so value at base_date == 100. Used for cross-series comparisons.
    Raises ValueError if base_date not found or base value is 0/None.
    """
    base_val = next(
        (r[price_field] for r in records if r["date"] == base_date and r[price_field]),
        None,
    )
    if not base_val:
        raise ValueError(f"rebase_to_100: no valid value at base_date={base_date}")
    return [
        {**r, output_field: round(r[price_field] / base_val * 100, 2) if r[price_field] else None}
        for r in records
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Validation / Output Guard
# ─────────────────────────────────────────────────────────────────────────────

def validate_series(
    records: list[dict],
    required_fields: list[str],
    min_records: int = 5,
    label: str = "series",
) -> bool:
    """
    Returns True if series is valid for writing to data.js.
    Logs specific failures but does not raise.
    """
    if len(records) < min_records:
        logger.warning("validate_series: %s has only %d records (min=%d)", label, len(records), min_records)
        return False

    missing_fields = [f for f in required_fields if f not in records[0]]
    if missing_fields:
        logger.error("validate_series: %s missing fields %s", label, missing_fields)
        return False

    return True
