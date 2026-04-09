"""
API Adapter Template — Power Dashboard Pipeline
----------------------------------------------
Copy this file for each new data source adapter.
Replace [SOURCE] with the source name (e.g. fmp, entso_e, ecb).
Replace [METRIC] with the metric name (e.g. ohlc, day_ahead_price, fx_rate).
"""

import os
import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Optional

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

SOURCE_BASE_URL = "https://api.example.com/v1"  # Replace with actual base URL

# ── Session Factory ────────────────────────────────────────────────────────────

def _make_session() -> requests.Session:
    """
    Shared session with retry for 5xx only.
    4xx errors (402, 403, 429) are NOT retried — they indicate plan/auth issues.
    """
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1.0,          # 1s, 2s, 4s
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


# ── Main Adapter Function ──────────────────────────────────────────────────────

def fetch_[source]_[metric](
    *,
    api_key: str,
    from_date: str,
    to_date: str,
    symbol: Optional[str] = None,
    extra_param: Optional[str] = None,
) -> list[dict]:
    """
    Fetch [description of what this fetches].

    Args:
        api_key:     API key from environment variable or config
        from_date:   Start date as 'YYYY-MM-DD'
        to_date:     End date as 'YYYY-MM-DD'
        symbol:      Instrument symbol (if applicable)
        extra_param: Additional parameter (if applicable)

    Returns:
        List of canonical dicts. Empty list [] on any recoverable error.
        Canonical schema:
            {
                "date":  str,     # YYYY-MM-DD
                "open":  float,
                "high":  float,
                "low":   float,
                "close": float,
                # add source-specific fields if needed:
                # "volume": float  (may be 0 for commodities)
            }

    Raises:
        ValueError: If api_key is missing or obviously invalid.
    """
    if not api_key:
        raise ValueError("fetch_[source]_[metric]: api_key is required")

    session = _make_session()
    url = f"{SOURCE_BASE_URL}/endpoint"
    params = {
        "from":   from_date,
        "to":     to_date,
        "apikey": api_key,
    }
    if symbol:
        params["symbol"] = symbol

    # ── Request ────────────────────────────────────────────────────────────────
    try:
        resp = session.get(url, params=params, timeout=15)
    except requests.Timeout:
        logger.warning("[source] timeout for symbol=%s", symbol)
        return []
    except requests.ConnectionError as exc:
        logger.error("[source] connection error for symbol=%s: %s", symbol, exc)
        return []

    # ── Response Status ────────────────────────────────────────────────────────
    if resp.status_code == 402:
        logger.critical("[source] HTTP 402 for %s — paid plan required", symbol)
        return []
    if resp.status_code == 403:
        logger.critical("[source] HTTP 403 for %s — check API key", symbol)
        return []
    if resp.status_code == 429:
        logger.critical("[source] HTTP 429 for %s — rate limit exceeded", symbol)
        return []
    if not resp.ok:
        logger.error("[source] HTTP %d for %s", resp.status_code, symbol)
        return []

    # ── Parse Response ─────────────────────────────────────────────────────────
    try:
        data = resp.json()
    except ValueError:
        logger.error("[source] non-JSON response for %s", symbol)
        return []

    # Validate top-level shape
    if not isinstance(data, list):
        logger.warning("[source] unexpected response shape for %s: %s", symbol, type(data).__name__)
        return []

    if len(data) == 0:
        logger.info("[source] empty data for %s (%s → %s)", symbol, from_date, to_date)
        return []

    # ── Normalize to Canonical Schema ──────────────────────────────────────────
    records = []
    for row in data:
        try:
            record = {
                "date":  row["date"],          # REQUIRED — use source field name
                "open":  float(row.get("open",  row.get("close", 0))),
                "high":  float(row.get("high",  row.get("close", 0))),
                "low":   float(row.get("low",   row.get("close", 0))),
                "close": float(row["close"]),  # REQUIRED
                # Add any additional canonical fields here
            }
            records.append(record)
        except (KeyError, TypeError, ValueError) as exc:
            # Log drift but continue processing remaining rows
            logger.warning(
                "[source] schema drift for %s on %s: %s",
                symbol, row.get("date", "?"), exc
            )

    # Sort ascending by date (some sources return newest-first)
    records.sort(key=lambda r: r["date"])

    logger.info("[source] fetched %d records for %s (%s → %s)", len(records), symbol, from_date, to_date)
    return records


# ── Pipeline Entry Point ───────────────────────────────────────────────────────

def run_[source]_pipeline(config: dict) -> dict:
    """
    Fetch all symbols for this source and return a keyed dict.
    Called by the main pipeline script.

    Returns:
        {
            'canonical_key': [ {date, open, high, low, close}, ... ],
            ...
        }
    """
    api_key = config.get("api_key") or os.environ.get("SOURCE_API_KEY", "")
    from_date = config.get("from_date", "2019-01-01")
    to_date = config.get("to_date")  # defaults to today in main script

    results = {}
    for symbol_config in config.get("symbols", []):
        key = symbol_config["key"]
        symbol = symbol_config["symbol"]

        records = fetch_[source]_[metric](
            api_key=api_key,
            from_date=from_date,
            to_date=to_date,
            symbol=symbol,
        )
        results[key] = records

        if not records:
            logger.warning("[source] no data returned for %s (%s)", key, symbol)

    return results
