"""
scripts/adapters/ecb.py
-----------------------
Fetches EUR/USD and GBP/EUR exchange rates from the ECB Statistical Data
Warehouse (SDW) public API.  No API key is required.

Endpoint:
  https://data-api.ecb.europa.eu/service/data/{flowRef}/{key}?format=csvdata&startPeriod=...

Series fetched are defined in config/series_map.py (ECB_SERIES).

Output columns: date, series_id, value, unit, source
"""

import logging
import sys
from datetime import datetime, timedelta, timezone
from io import StringIO
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
from config.series_map import ECB_SERIES
from config.settings import (
    DATA_RAW_DIR,
    LOOKBACK_YEARS,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)

ECB_API_BASE = "https://data-api.ecb.europa.eu/service/data"


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
    series_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> pd.DataFrame:
    """
    Fetch an ECB exchange-rate series and cache it incrementally.

    Returns DataFrame with columns: date, series_id, value, unit, source
    """
    flow_key = ECB_SERIES.get(series_id)
    if not flow_key:
        logger.warning("ECB: unknown series_id '%s'", series_id)
        return pd.DataFrame()

    cache_path = DATA_RAW_DIR / f"ecb_{series_id}.csv"
    now = datetime.now(timezone.utc)
    default_start = now - timedelta(days=365 * LOOKBACK_YEARS)

    if cache_path.exists():
        cached = pd.read_csv(cache_path, parse_dates=["date"])
        if not cached.empty:
            last_dt = pd.to_datetime(cached["date"].max())
            fetch_start = last_dt.to_pydatetime() - timedelta(days=1)
            logger.info("ECB cache hit for %s — fetching from %s", series_id, fetch_start.date())
        else:
            fetch_start = default_start
            cached = pd.DataFrame()
    else:
        cached = pd.DataFrame()
        fetch_start = start_date or default_start

    # ECB flow_key format: "EXR/D.USD.EUR.SP00.A"
    flow_ref, key = flow_key.split("/", 1)
    url = f"{ECB_API_BASE}/{flow_ref}/{key}"
    params = {
        "format": "csvdata",
        "startPeriod": fetch_start.strftime("%Y-%m-%d"),
        "endPeriod": (end_date or now).strftime("%Y-%m-%d"),
    }
    logger.info("ECB fetch: series=%s  %s", series_id, fetch_start.date())

    try:
        resp = _get(url, params)
        df = pd.read_csv(StringIO(resp.text))
        df.columns = [c.strip() for c in df.columns]
        # ECB CSV has columns TIME_PERIOD, OBS_VALUE (and many others)
        if "TIME_PERIOD" not in df.columns or "OBS_VALUE" not in df.columns:
            logger.warning("ECB: unexpected CSV columns for %s: %s", series_id, list(df.columns))
            return cached if not cached.empty else pd.DataFrame()

        df = df[["TIME_PERIOD", "OBS_VALUE"]].rename(
            columns={"TIME_PERIOD": "date", "OBS_VALUE": "value"}
        )
        df["series_id"] = series_id
        df["unit"] = "FX"
        df["source"] = "ecb"
        df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
        df["value"] = pd.to_numeric(df["value"], errors="coerce").round(6)
        df.dropna(subset=["date", "value"], inplace=True)
    except Exception as exc:
        logger.warning("ECB fetch failed for %s: %s", series_id, exc)
        return cached if not cached.empty else pd.DataFrame()

    all_data = pd.concat([cached, df], ignore_index=True)
    # Normalize date column to datetime before sorting/deduplication to avoid
    # TypeError when cached CSV timestamps are mixed with freshly fetched strings.
    all_data["date"] = pd.to_datetime(all_data["date"], errors="coerce")
    all_data.dropna(subset=["date"], inplace=True)
    all_data.sort_values("date", inplace=True)
    all_data.drop_duplicates(subset=["date", "series_id"], inplace=True)
    all_data["date"] = all_data["date"].dt.strftime("%Y-%m-%d")
    all_data.to_csv(cache_path, index=False)
    logger.info("ECB %s: %d rows cached", series_id, len(all_data))
    return all_data


def fetch_all() -> dict[str, pd.DataFrame]:
    """Fetch all configured ECB exchange-rate series."""
    results: dict[str, pd.DataFrame] = {}
    for sid in ECB_SERIES:
        results[sid] = fetch(sid)
    return results
