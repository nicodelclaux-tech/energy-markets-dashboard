"""
scripts/adapters/eia.py
-----------------------
Fetches oil and natural-gas benchmark spot prices plus US gas storage
from the EIA Open Data API v2.

API docs: https://www.eia.gov/opendata/

Series fetched are defined in config/series_map.py (EIA_SERIES).

Output columns: date, series_id, value, unit, source
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
from config.series_map import EIA_SERIES
from config.settings import (
    DATA_RAW_DIR,
    EIA_API_KEY,
    LOOKBACK_YEARS,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)

EIA_BASE_URL = "https://api.eia.gov/v2"
EIA_PAGE_SIZE = 5000


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
def _get(route: str, params: dict) -> dict:
    """Fetch one page of EIA v2 data; returns the JSON response dict."""
    url = f"{EIA_BASE_URL}/{route}"
    # Exclude the API key from log output
    safe_params = {k: v for k, v in params.items() if k != "api_key"}
    logger.info("EIA request: %s  params=%s", url, safe_params)
    resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _fetch_series(
    series_id: str,
    route: str,
    facet_key: str,
    unit: str,
    frequency: str,
    start_date: datetime,
    end_date: datetime,
) -> pd.DataFrame:
    """
    Fetch all pages for one EIA v2 series between start_date and end_date.
    Returns a tidy DataFrame.
    """
    records: list[dict] = []
    offset = 0
    while True:
        params = {
            "api_key": EIA_API_KEY,
            "frequency": frequency,
            "data[0]": "value",
            f"facets[series][]": facet_key,
            "start": start_date.strftime("%Y-%m-%d"),
            "end": end_date.strftime("%Y-%m-%d"),
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "offset": offset,
            "length": EIA_PAGE_SIZE,
        }
        try:
            payload = _get(route, params)
        except Exception as exc:
            logger.warning("EIA page fetch failed (%s offset=%d): %s", series_id, offset, exc)
            break

        data = payload.get("response", {}).get("data", [])
        if not data:
            break
        records.extend(data)
        if len(data) < EIA_PAGE_SIZE:
            break
        offset += EIA_PAGE_SIZE

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    # period column may be "YYYY-MM-DD" or "YYYY-MM" or "YYYY-Wxx"
    df["date"] = pd.to_datetime(df["period"], errors="coerce").dt.strftime("%Y-%m-%d")
    df["value"] = pd.to_numeric(df["value"], errors="coerce").round(4)
    df["series_id"] = series_id
    df["unit"] = unit
    df["source"] = "eia"
    df.dropna(subset=["date", "value"], inplace=True)
    return df[["date", "series_id", "value", "unit", "source"]]


def fetch(
    series_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> pd.DataFrame:
    """
    Fetch an EIA series and cache it incrementally.

    Returns DataFrame with columns: date, series_id, value, unit, source
    """
    if not EIA_API_KEY:
        logger.warning("EIA_API_KEY not set — skipping %s", series_id)
        return pd.DataFrame()

    config = EIA_SERIES.get(series_id)
    if not config:
        logger.warning("EIA: unknown series '%s'", series_id)
        return pd.DataFrame()

    route, facet_key, unit, frequency = config
    cache_path = DATA_RAW_DIR / f"eia_{series_id}.csv"
    now = datetime.now(timezone.utc)
    default_start = now - timedelta(days=365 * LOOKBACK_YEARS)

    if cache_path.exists():
        cached = pd.read_csv(cache_path, parse_dates=["date"])
        if not cached.empty:
            last_dt = pd.to_datetime(cached["date"].max())
            fetch_start = last_dt.to_pydatetime() - timedelta(days=7)
            logger.info("EIA cache hit for %s — fetching from %s", series_id, fetch_start.date())
        else:
            fetch_start = default_start
            cached = pd.DataFrame()
    else:
        cached = pd.DataFrame()
        fetch_start = start_date or default_start

    df_new = _fetch_series(
        series_id, route, facet_key, unit, frequency,
        fetch_start, end_date or now
    )

    all_data = pd.concat([cached, df_new], ignore_index=True) if not df_new.empty else cached
    if all_data.empty:
        return pd.DataFrame()

    all_data.sort_values("date", inplace=True)
    all_data.drop_duplicates(subset=["date", "series_id"], inplace=True)
    all_data.to_csv(cache_path, index=False)
    logger.info("EIA %s: %d rows cached", series_id, len(all_data))
    return all_data


def fetch_all() -> dict[str, pd.DataFrame]:
    """Fetch all configured EIA series."""
    results: dict[str, pd.DataFrame] = {}
    for sid in EIA_SERIES:
        results[sid] = fetch(sid)
    return results
