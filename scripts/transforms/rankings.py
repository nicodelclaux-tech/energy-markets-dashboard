"""
scripts/transforms/rankings.py
-------------------------------
Utilities for ranking countries on a given metric.

Used by build_data_js.py to pre-compute country comparison tables that the
frontend can display directly.
"""

import logging
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)


def rank_countries(
    metric_dict: dict[str, Optional[float]],
    ascending: bool = True,
) -> list[dict]:
    """
    Rank countries by a scalar metric value.

    Parameters
    ----------
    metric_dict : {country_code: value | None}
    ascending   : True means lowest value = rank 1

    Returns
    -------
    List of dicts sorted by rank:
        [{"country": "DE", "value": 80.5, "rank": 1}, ...]
    """
    valid = {cc: v for cc, v in metric_dict.items() if v is not None and not pd.isna(v)}
    if not valid:
        return []

    ranked = sorted(valid.items(), key=lambda x: x[1], reverse=not ascending)
    return [
        {"country": cc, "value": round(float(v), 4), "rank": i + 1}
        for i, (cc, v) in enumerate(ranked)
    ]


def compute_top_bottom(
    metric_dict: dict[str, Optional[float]],
    n: int = 3,
) -> dict:
    """
    Return top-N (highest) and bottom-N (lowest) countries for a metric.

    Returns
    -------
    {"top": [...], "bottom": [...]}  each list contains rank dicts
    """
    ranked_asc = rank_countries(metric_dict, ascending=True)
    ranked_desc = rank_countries(metric_dict, ascending=False)
    return {
        "top": ranked_desc[:n],
        "bottom": ranked_asc[:n],
    }


def compute_country_rankings(countries_data: dict[str, dict]) -> dict:
    """
    Given a dict of {country_code: {metric: value, ...}} compute rankings for
    each common metric.

    Parameters
    ----------
    countries_data : {country_code: {"latest_price_eur_mwh": float, ...}}

    Returns
    -------
    {metric_name: {"rankings": [...], "top": [...], "bottom": [...]}}
    """
    # Collect all metric names
    all_metrics: set[str] = set()
    for info in countries_data.values():
        all_metrics.update(info.keys())

    result: dict = {}
    for metric in all_metrics:
        metric_dict = {
            cc: info.get(metric)
            for cc, info in countries_data.items()
            if info.get(metric) is not None
        }
        if not metric_dict:
            continue
        rankings = rank_countries(metric_dict, ascending=True)
        top_bottom = compute_top_bottom(metric_dict, n=3)
        result[metric] = {
            "rankings": rankings,
            **top_bottom,
        }

    return result
