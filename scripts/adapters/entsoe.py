"""
scripts/adapters/entsoe.py
--------------------------
Fetches ENTSO-E Transparency Platform day-ahead electricity prices
(document type A44) for each configured bidding zone.

API docs: https://transparency.entsoe.eu/content/static_content/Static%20content/
          web%20api/Guide.html

The API returns XML.  We parse it with the standard library xml.etree module
to avoid an extra dependency.

Data is stored incrementally in data/raw/entsoe_{country_code}.csv so that
each run only adds missing rows rather than re-downloading years of history.
"""

import logging
import sys
import time
import xml.etree.ElementTree as ET
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
from config.series_map import ENTSOE_BIDDING_ZONES
from config.settings import (
    DATA_RAW_DIR,
    ENTSOE_API_KEY,
    LOOKBACK_YEARS,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)

ENTSOE_API_URL = "https://web-api.tp.entsoe.eu/api"
# A44 = Day-ahead prices document type
DOCUMENT_TYPE = "A44"
# ENTSO-E timestamps use format YYYYMMDDHHmm
TS_FMT = "%Y%m%d%H%M"
# Fetch in 30-day windows to avoid API payload limits
CHUNK_DAYS = 30

NS = {"ns": "urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:3"}


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
def _get(params: dict) -> requests.Response:
    """Single HTTP GET to the ENTSO-E API with retry logic."""
    resp = requests.get(ENTSOE_API_URL, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp


def _parse_xml(xml_text: str, country_code: str) -> pd.DataFrame:
    """Parse ENTSO-E A44 XML response into a tidy DataFrame."""
    root = ET.fromstring(xml_text)
    records: list[dict] = []
    for ts in root.findall(".//ns:TimeSeries", NS):
        # Resolution (e.g. PT60M) – we handle hourly only
        resolution = ts.findtext("ns:Period/ns:resolution", default="PT60M", namespaces=NS)
        minutes = 60
        if resolution == "PT30M":
            minutes = 30
        elif resolution == "PT15M":
            minutes = 15

        for period in ts.findall("ns:Period", NS):
            start_str = period.findtext("ns:timeInterval/ns:start", default="", namespaces=NS)
            if not start_str:
                continue
            try:
                period_start = datetime.strptime(start_str, "%Y-%m-%dT%H:%MZ").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                continue

            for pt in period.findall("ns:Point", NS):
                pos_str = pt.findtext("ns:position", default="1", namespaces=NS)
                price_str = pt.findtext("ns:price.amount", default="", namespaces=NS)
                if not price_str:
                    continue
                try:
                    position = int(pos_str)
                    price = float(price_str)
                except ValueError:
                    continue
                dt = period_start + timedelta(minutes=minutes * (position - 1))
                records.append(
                    {
                        "datetime_utc": dt.strftime("%Y-%m-%dT%H:%M"),
                        "date": dt.strftime("%Y-%m-%d"),
                        "country_code": country_code,
                        "value": price,
                        "unit": "EUR/MWh",
                    }
                )

    if not records:
        return pd.DataFrame(columns=["datetime_utc", "date", "country_code", "value", "unit"])
    return pd.DataFrame(records)


def _fetch_chunk(
    country_code: str,
    eic: str,
    start: datetime,
    end: datetime,
    api_key: str,
) -> pd.DataFrame:
    """Fetch one time window for one bidding zone."""
    params = {
        "documentType": DOCUMENT_TYPE,
        "in_Domain": eic,
        "out_Domain": eic,
        "periodStart": start.strftime(TS_FMT),
        "periodEnd": end.strftime(TS_FMT),
        "securityToken": api_key,
    }
    logger.info(
        "ENTSO-E fetch: country=%s  %s → %s",
        country_code,
        start.date(),
        end.date(),
    )
    try:
        resp = _get(params)
        return _parse_xml(resp.text, country_code)
    except Exception as exc:
        logger.warning("ENTSO-E chunk failed (%s %s–%s): %s", country_code, start.date(), end.date(), exc)
        return pd.DataFrame()


def fetch(
    country_code: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> pd.DataFrame:
    """
    Fetch day-ahead prices for *country_code* over a 5-year window.

    If a cached CSV already exists the function only fetches the missing tail
    so each CI run is cheap.

    Returns a DataFrame with columns:
        date (YYYY-MM-DD), country_code, value (EUR/MWh), unit
    """
    if not ENTSOE_API_KEY:
        logger.warning("ENTSOE_API_KEY not set — skipping %s", country_code)
        return pd.DataFrame()

    eic = ENTSOE_BIDDING_ZONES.get(country_code)
    if not eic:
        logger.warning("No EIC for %s", country_code)
        return pd.DataFrame()

    cache_path = DATA_RAW_DIR / f"entsoe_{country_code}.csv"

    # Determine start of fetch window
    now = datetime.now(timezone.utc)
    end_date = end_date or now
    default_start = now - timedelta(days=365 * LOOKBACK_YEARS)

    if cache_path.exists():
        cached = pd.read_csv(cache_path, parse_dates=["date"])
        if not cached.empty:
            last_cached = pd.to_datetime(cached["date"].max())
            fetch_start = last_cached.to_pydatetime().replace(tzinfo=timezone.utc) - timedelta(days=1)
            logger.info("Cache hit for %s — fetching from %s", country_code, fetch_start.date())
        else:
            fetch_start = default_start
    else:
        cached = pd.DataFrame()
        fetch_start = start_date or default_start

    # Fetch in CHUNK_DAYS windows
    chunks: list[pd.DataFrame] = []
    cursor = fetch_start
    while cursor < end_date:
        chunk_end = min(cursor + timedelta(days=CHUNK_DAYS), end_date)
        df_chunk = _fetch_chunk(country_code, eic, cursor, chunk_end, ENTSOE_API_KEY)
        if not df_chunk.empty:
            chunks.append(df_chunk)
        cursor = chunk_end
        # Be polite to the API
        time.sleep(0.5)

    if not chunks and cached.empty:
        return pd.DataFrame()

    all_data = pd.concat([cached] + chunks, ignore_index=True) if chunks else cached
    # Compute daily average price (multiple hourly points per day)
    if "value" in all_data.columns and "date" in all_data.columns:
        all_data["date"] = pd.to_datetime(all_data["date"]).dt.strftime("%Y-%m-%d")
        daily = (
            all_data.groupby(["date", "country_code", "unit"], as_index=False)["value"]
            .mean()
            .round(4)
        )
        daily.sort_values("date", inplace=True)
        daily.drop_duplicates(subset=["date", "country_code"], inplace=True)
        daily.to_csv(cache_path, index=False)
        logger.info("ENTSO-E %s: %d daily rows cached", country_code, len(daily))
        return daily
    return all_data


def fetch_all() -> dict[str, pd.DataFrame]:
    """Fetch day-ahead prices for every configured country."""
    results: dict[str, pd.DataFrame] = {}
    for cc in ENTSOE_BIDDING_ZONES:
        results[cc] = fetch(cc)
    return results
