"""
scripts/adapters/ember.py
-------------------------
Fetches European electricity generation-mix data from Ember Climate.

Primary source: Ember's public API (https://api.ember-energy.org)
Fallback:       Ember's published yearly CSV data file

The adapter tries the API first.  If that fails (missing key, rate-limit,
network error) it attempts to download the free CSV.  If both fail it
returns an empty DataFrame and logs a warning.

Output columns: date, country_code, source_type, value_twh, share_pct, unit
"""

import logging
import sys
from datetime import datetime
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
from config.series_map import COUNTRIES
from config.settings import (
    DATA_RAW_DIR,
    EMBER_API_KEY,
    LOOKBACK_YEARS,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)

EMBER_API_BASE = "https://api.ember-energy.org/v1"
# Public CSV with European monthly generation by source
EMBER_CSV_URL = (
    "https://ember-energy.org/app/uploads/European-Electricity-Review-2024.csv"
)


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
def _get(url: str, params: Optional[dict] = None, headers: Optional[dict] = None) -> requests.Response:
    resp = requests.get(url, params=params or {}, headers=headers or {}, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp


def _fetch_via_api(country_code: str) -> pd.DataFrame:
    """
    Attempt to fetch generation mix from the Ember v1 API.
    Returns empty DataFrame if API is unavailable or data is missing.
    """
    headers: dict = {}
    if EMBER_API_KEY:
        headers["Authorization"] = f"Bearer {EMBER_API_KEY}"

    start_year = datetime.now().year - LOOKBACK_YEARS
    params = {
        "entity_code": country_code,
        "frequency": "monthly",
        "is_aggregate_entity": "false",
        "start_date": f"{start_year}-01",
        "series": "generation",
    }
    try:
        resp = _get(f"{EMBER_API_BASE}/electricity-generation/monthly", params=params, headers=headers)
        data = resp.json()
        rows = data.get("data", [])
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows)
        df["country_code"] = country_code
        df["date"] = pd.to_datetime(df.get("date", df.get("month", ""))).dt.strftime("%Y-%m-%d")
        return df[["date", "country_code", "series", "generation_twh", "share_of_generation_pct"]].rename(
            columns={
                "series": "source_type",
                "generation_twh": "value_twh",
                "share_of_generation_pct": "share_pct",
            }
        )
    except Exception as exc:
        logger.debug("Ember API attempt failed for %s: %s", country_code, exc)
        return pd.DataFrame()


def _fetch_via_csv() -> pd.DataFrame:
    """
    Download and parse Ember's public European Electricity Review CSV.
    Returns tidy DataFrame or empty on failure.
    """
    logger.info("Ember: attempting public CSV download")
    try:
        resp = _get(EMBER_CSV_URL)
        df = pd.read_csv(StringIO(resp.text))
        # Normalise column names
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        needed = {"country_code", "date", "source_type", "value_twh"}
        # Try to map common column name variants
        rename_map = {}
        for col in df.columns:
            if "country" in col and "country_code" not in df.columns:
                rename_map[col] = "country_code"
            if col in ("area", "region") and "country_code" not in df.columns:
                rename_map[col] = "country_code"
            if col in ("fuel", "source", "technology") and "source_type" not in df.columns:
                rename_map[col] = "source_type"
            if col in ("generation_twh", "value", "twh") and "value_twh" not in df.columns:
                rename_map[col] = "value_twh"
        df.rename(columns=rename_map, inplace=True)

        if not needed.issubset(df.columns):
            logger.warning("Ember CSV missing expected columns: %s", needed - set(df.columns))
            return pd.DataFrame()

        # Filter to configured countries
        country_names = set(COUNTRIES.values())
        iso_codes = set(COUNTRIES.keys())
        mask = df["country_code"].isin(country_names | iso_codes)
        df = df[mask].copy()

        df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
        df.dropna(subset=["date"], inplace=True)
        df["share_pct"] = df.get("share_pct", pd.Series(dtype=float))
        df["unit"] = "TWh"
        return df[["date", "country_code", "source_type", "value_twh", "share_pct", "unit"]]
    except Exception as exc:
        logger.warning("Ember CSV download failed: %s", exc)
        return pd.DataFrame()


def fetch(country_code: str) -> pd.DataFrame:
    """
    Fetch Ember generation-mix data for *country_code*.

    Tries the API first, falls back to the public CSV, caches the result.
    """
    cache_path = DATA_RAW_DIR / f"ember_{country_code}.csv"

    df = _fetch_via_api(country_code)
    if df.empty:
        logger.info("Ember API returned no data for %s — trying CSV", country_code)
        df = _fetch_via_csv()
        if not df.empty:
            # Filter to just this country
            name = COUNTRIES.get(country_code, country_code)
            df = df[df["country_code"].isin([country_code, name])].copy()
            df["country_code"] = country_code

    if df.empty:
        logger.warning("Ember: no data obtained for %s", country_code)
        return pd.DataFrame()

    df.sort_values("date", inplace=True)
    df.to_csv(cache_path, index=False)
    logger.info("Ember %s: %d rows cached", country_code, len(df))
    return df


def fetch_all() -> dict[str, pd.DataFrame]:
    """Fetch Ember data for every configured country."""
    results: dict[str, pd.DataFrame] = {}
    for cc in COUNTRIES:
        results[cc] = fetch(cc)
    return results
