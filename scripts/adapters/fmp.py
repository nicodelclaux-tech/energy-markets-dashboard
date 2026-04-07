"""
scripts/adapters/fmp.py
-----------------------
Fetches commodity spot prices and FX rates from Financial Modeling Prep (FMP).

Free-tier endpoint used:
  GET /api/v3/historical-price-full/{symbol}?from=YYYY-MM-DD&to=YYYY-MM-DD&apikey=KEY

Symbols fetched are defined in config/series_map.py (FMP_SYMBOLS).

Output columns: date, symbol, close, unit, source
"""

import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import pandas as pd
import requests
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from config.series_map import FMP_SYMBOLS
from config.settings import (
    DATA_RAW_DIR,
    FMP_API_KEY,
    LOOKBACK_YEARS,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)

FMP_BASE = "https://financialmodelingprep.com/api/v3"


def _should_retry(exc: BaseException) -> bool:
    if isinstance(exc, requests.HTTPError):
        return exc.response is not None and exc.response.status_code in (429, 500, 502, 503)
    return isinstance(exc, (requests.ConnectionError, requests.Timeout))


@retry(
    retry=retry_if_exception(_should_retry),
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=RETRY_BACKOFF, min=2, max=60),
    reraise=True,
)
def _get(url: str, params: dict) -> requests.Response:
    resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp


def fetch(
    symbol: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> pd.DataFrame:
    """
    Fetch historical daily prices for *symbol* from FMP.

    Uses a cached CSV to avoid redundant downloads.  Only new rows since the
    last cached date are fetched on subsequent runs.

    Returns DataFrame with columns: date, symbol, close, unit, source
    """
    if not FMP_API_KEY:
        logger.warning("FMP_API_KEY not set — skipping %s", symbol)
        return pd.DataFrame()

    _, unit = FMP_SYMBOLS.get(symbol, (symbol, "unknown"))
    cache_path = DATA_RAW_DIR / f"fmp_{symbol}.csv"

    now = datetime.now(timezone.utc)
    end_dt = end_date or now
    default_start = now - timedelta(days=365 * LOOKBACK_YEARS)

    if cache_path.exists():
        cached = pd.read_csv(cache_path, parse_dates=["date"])
        if not cached.empty:
            last_dt = pd.to_datetime(cached["date"].max())
            fetch_start = last_dt.to_pydatetime() - timedelta(days=1)
            logger.info("FMP cache hit for %s — fetching from %s", symbol, fetch_start.date())
        else:
            fetch_start = default_start
            cached = pd.DataFrame()
    else:
        cached = pd.DataFrame()
        fetch_start = start_date or default_start

    url = f"{FMP_BASE}/historical-price-full/{symbol}"
    params = {
        "from": fetch_start.strftime("%Y-%m-%d"),
        "to": end_dt.strftime("%Y-%m-%d"),
        "apikey": FMP_API_KEY,
    }
    logger.info("FMP fetch: symbol=%s  %s → %s", symbol, fetch_start.date(), end_dt.date())
    try:
        resp = _get(url, params)
        payload = resp.json()
        historical = payload.get("historical", [])
        if not historical:
            logger.warning("FMP: no data returned for %s", symbol)
            return cached if not cached.empty else pd.DataFrame()

        df = pd.DataFrame(historical)
        df = df[["date", "close"]].copy()
        df["symbol"] = symbol
        df["unit"] = unit
        df["source"] = "fmp"
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        df["close"] = pd.to_numeric(df["close"], errors="coerce").round(4)
        df.dropna(subset=["close"], inplace=True)
    except Exception as exc:
        logger.warning("FMP fetch failed for %s: %s", symbol, exc)
        return cached if not cached.empty else pd.DataFrame()

    all_data = pd.concat([cached, df], ignore_index=True)
    all_data.sort_values("date", inplace=True)
    all_data.drop_duplicates(subset=["date", "symbol"], inplace=True)
    all_data.to_csv(cache_path, index=False)
    logger.info("FMP %s: %d rows cached", symbol, len(all_data))
    return all_data


def fetch_all() -> dict[str, pd.DataFrame]:
    """Fetch historical prices for all configured FMP symbols."""
    results: dict[str, pd.DataFrame] = {}
    for symbol in FMP_SYMBOLS:
        results[symbol] = fetch(symbol)
    return results
